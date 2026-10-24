#!/usr/bin/env node
// Live Deck authoring CLI. Zero dependencies beyond the project itself; runs on
// Node >= 24 with native TypeScript: `node bin/live-deck.ts <command>`.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DeckSchema, parseDeck, type Deck, type Theme } from "../shared/deck.ts";
import { PRESET_NAMES, type PresetName, type ThemeMode } from "../shared/themes.ts";
import { DECK_ID } from "../server/decks.ts";
import { contrastWarnings, THEME_MODES } from "../shared/themes.ts";
import { imageSize, isSixteenByNine } from "./image-size.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const DECKS_DIR = resolve(process.env.DECKS_DIR || join(REPO, "decks"));

const USAGE = `Usage: live-deck <command> [args]

Commands:
  validate <deck.json | deck-dir | deck-id>   Check a deck against format v1 and its assets
  new <id> [--title "..."] [--preset <name>] [--mode light|dark]
                                               Scaffold decks/<id>/deck.json from a template
  import <folder> --id <id> [--title "..."]    Build decks/<id> from slide images exported by any tool
  list                                         List decks with title and slide count
  publish <id> [--dry-run]                     Validate decks/<id> and copy it to the server (rsync)
  help                                         Show this help

Deck ids: lowercase letters, digits and dashes (${DECK_ID.source}).
Decks root: ${DECKS_DIR} (override with DECKS_DIR).
Preview a deck in the browser at /preview/<id>.

New: without --preset the template keeps its own plain dark colours. --preset
picks one of ${PRESET_NAMES.join(", ")}; --mode flips it
to its light or dark variant (--mode alone flips estudio).

Validate also warns when the theme's text, muted or accent colour reads low
against the background (below 4.5:1, 3:1 and 3:1).

Publish: copies decks/<id>/ to $LIVE_DECK_PUBLISH_TARGET/<id>/ with rsync,
e.g. LIVE_DECK_PUBLISH_TARGET=user@host:/opt/live-deck/decks (or a local path).
Files deleted locally are removed only inside that deck. The server reads decks
when a session is created, so no restart is needed. Set LIVE_DECK_PUBLIC_URL
(e.g. https://events.example.com) to print the preview link.

Import: takes .png, .jpg, .jpeg and .webp files (up to 200) in natural order
(slide2 before slide10), copies them to decks/<id>/assets/slide-01.<ext>... as
full-slide backgrounds and puts the join QR on slide 1. The title defaults to
the folder name. Images that are not 16:9 are letterboxed (a warning names them).
`;

interface Report {
  deck?: Deck;
  errors: string[];
  warnings: string[];
}

/** Resolves a CLI argument to a deck.json path: file, directory, or bare deck id. */
function resolveDeckFile(arg: string): string {
  const looksLikePath = arg.endsWith(".json") || arg.includes("/") || arg.includes(sep) || arg.startsWith(".");
  if (!looksLikePath) return join(DECKS_DIR, arg, "deck.json");
  const p = resolve(arg);
  return existsSync(p) && statSync(p).isDirectory() ? join(p, "deck.json") : p;
}

function check(file: string): Report {
  const report: Report = { errors: [], warnings: [] };
  if (!existsSync(file)) {
    report.errors.push(`deck: file not found: ${file}`);
    return report;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    report.errors.push(`deck: invalid JSON: ${(err as Error).message}`);
    return report;
  }
  const parsed = parseDeck(raw);
  if (!parsed.ok) {
    // parseDeck joins issues into one string; re-run the same schema to print one per line.
    const result = DeckSchema.safeParse(raw);
    const issues = result.success ? [] : result.error.issues;
    report.errors.push(...(issues.length ? issues.map((i) => `${i.path.join(".") || "deck"}: ${i.message}`) : [parsed.error]));
    return report;
  }
  const deck = parsed.deck;
  report.deck = deck;
  const deckDir = dirname(file);
  deck.slides.forEach((slide, s) => {
    const bg = typeof slide.background === "object" ? slide.background.image : undefined;
    if (bg?.startsWith("assets/") && !existsSync(join(deckDir, bg))) {
      report.errors.push(`slides.${s}.background.image: asset not found: ${bg}`);
    }
    slide.elements.forEach((el, e) => {
      if (el.type === "image" && el.src.startsWith("assets/") && !existsSync(join(deckDir, el.src))) {
        report.errors.push(`slides.${s}.elements.${e}.src: asset not found: ${el.src}`);
      }
    });
  });
  if (!deck.slides[0]?.elements.some((el) => el.type === "qr")) {
    report.warnings.push("slides.0: first slide has no qr element; the audience cannot scan to join");
  }
  for (const w of contrastWarnings(deck.theme)) {
    report.warnings.push(`theme.${w.key}: contrast ${w.ratio.toFixed(1)}:1 against the background is below ${w.min}:1`);
  }
  return report;
}

function validate(args: string[]): number {
  const target = args[0];
  if (!target) {
    process.stderr.write(`validate needs a deck path, directory or id\n\n${USAGE}`);
    return 2;
  }
  const report = check(resolveDeckFile(target));
  for (const w of report.warnings) process.stderr.write(`warning: ${w}\n`);
  if (report.errors.length || !report.deck) {
    for (const e of report.errors) process.stdout.write(`${e}\n`);
    return 1;
  }
  const quizzes = report.deck.slides.filter((s) => s.quiz).length;
  const asks = report.deck.slides.filter((s) => s.ask).length;
  const open = asks ? `, ${asks} open question${asks === 1 ? "" : "s"}` : "";
  process.stdout.write(`OK ${report.deck.title} (${report.deck.slides.length} slides, ${quizzes} quizzes${open})\n`);
  return 0;
}

/** The plain dark colours the template has always shipped; a preset replaces them and colours the subtitle itself. */
const PLAIN_THEME: Theme = { background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" };

// Element colours are theme tokens (shared/theme-colors.ts), so the template follows whatever theme the deck ends up with.
function template(title: string, theme: Theme = PLAIN_THEME): Deck {
  const subtitleColor = theme === PLAIN_THEME ? { color: "muted" } : {};
  return {
    version: 1,
    title,
    theme,
    slides: [
      {
        id: "cover",
        notes: "Welcome the audience and ask them to scan the QR code.",
        elements: [
          { id: "title", type: "text", box: { x: 0.07, y: 0.22, w: 0.52, h: 0.36 }, text: title, style: { fontSize: 96, fontWeight: 800, font: "display", lineHeight: 1.05 } },
          { id: "subtitle", type: "text", box: { x: 0.07, y: 0.64, w: 0.48, h: 0.12 }, text: "Scan the code to join from your phone.", style: { fontSize: 36, ...subtitleColor, lineHeight: 1.3 } },
          { id: "qr", type: "qr", box: { x: 0.64, y: 0.16, w: 0.29, h: 0.68 } },
        ],
      },
      {
        id: "points",
        notes: "Each point appears on 'next'.",
        elements: [
          { id: "heading", type: "text", box: { x: 0.07, y: 0.1, w: 0.86, h: 0.14 }, text: "Three key points", style: { fontSize: 80, fontWeight: 800, font: "display" } },
          { id: "p1", type: "text", box: { x: 0.07, y: 0.32, w: 0.86, h: 0.14 }, text: "First point", fragment: 1, style: { fontSize: 44 } },
          { id: "p2", type: "text", box: { x: 0.07, y: 0.5, w: 0.86, h: 0.14 }, text: "Second point", fragment: 2, style: { fontSize: 44 } },
          { id: "p3", type: "text", box: { x: 0.07, y: 0.68, w: 0.86, h: 0.14 }, text: "Third point", fragment: 3, style: { fontSize: 44 } },
        ],
      },
      {
        id: "quiz-1",
        layout: "quiz",
        notes: "Votes stay hidden until you reveal the answer.",
        elements: [],
        quiz: { question: "Which point matters most?", options: ["First", "Second", "Third"], correctIndex: 1, display: "secret", timerSec: 30 },
      },
      {
        id: "closing",
        notes: "Thank the audience and end the session to download the summary.",
        elements: [
          { id: "thanks", type: "text", box: { x: 0.07, y: 0.3, w: 0.86, h: 0.26 }, text: "Thank you", style: { fontSize: 180, fontWeight: 800, font: "display", align: "center", valign: "middle" } },
        ],
      },
    ],
  };
}

function scaffold(args: string[]): number {
  const id = args[0];
  if (!id || id.startsWith("-")) {
    process.stderr.write(`new needs a deck id\n\n${USAGE}`);
    return 2;
  }
  if (!DECK_ID.test(id)) {
    process.stderr.write(`invalid deck id "${id}": use lowercase letters, digits and dashes (${DECK_ID.source})\n`);
    return 1;
  }
  const flag = (name: string): string | undefined | null => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const value = args[i + 1];
    return value && !value.startsWith("--") ? value : null;
  };
  const title = flag("--title");
  const preset = flag("--preset");
  const mode = flag("--mode");
  if (title === null || preset === null || mode === null) {
    process.stderr.write(`${title === null ? "--title" : preset === null ? "--preset" : "--mode"} needs a value\n`);
    return 2;
  }
  if (preset !== undefined && !(PRESET_NAMES as readonly string[]).includes(preset)) {
    process.stderr.write(`unknown preset "${preset}": use one of ${PRESET_NAMES.join(", ")}\n`);
    return 2;
  }
  if (mode !== undefined && !(THEME_MODES as readonly string[]).includes(mode)) {
    process.stderr.write(`unknown mode "${mode}": use light or dark\n`);
    return 2;
  }
  const dir = join(DECKS_DIR, id);
  const file = join(dir, "deck.json");
  if (existsSync(file)) {
    process.stderr.write(`deck "${id}" already exists at ${file}; refusing to overwrite\n`);
    return 1;
  }
  // --mode alone flips the default preset; without either flag the template keeps its plain colours.
  const theme: Theme | undefined =
    preset !== undefined || mode !== undefined ? { preset: (preset ?? "estudio") as PresetName, ...(mode !== undefined ? { mode: mode as ThemeMode } : {}) } : undefined;
  const deck = template(title ?? id, theme);
  const parsed = parseDeck(deck);
  if (!parsed.ok) {
    process.stderr.write(`template is invalid: ${parsed.error}\n`);
    return 1;
  }
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(deck, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`Created ${file}\nValidate: node bin/live-deck.ts validate ${id}\nPreview:  /preview/${id}\n`);
  return 0;
}

const IMPORT_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_SLIDES = 200;

function importDeck(args: string[]): number {
  const flag = (name: string): string | undefined | null => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const value = args[i + 1];
    return value && !value.startsWith("--") ? value : null;
  };
  const id = flag("--id");
  const titleArg = flag("--title");
  const folderArg = args.find((a, i) => !a.startsWith("--") && !["--id", "--title"].includes(args[i - 1] ?? ""));
  if (!folderArg || !id || titleArg === null) {
    process.stderr.write(`import needs a folder and --id <id>${titleArg === null ? "; --title needs a value" : ""}\n\n${USAGE}`);
    return 2;
  }
  const fail = (message: string): number => {
    process.stderr.write(`${message}\n`);
    return 1;
  };
  if (!DECK_ID.test(id)) return fail(`invalid deck id "${id}": use lowercase letters, digits and dashes (${DECK_ID.source})`);
  const dir = join(DECKS_DIR, id);
  if (existsSync(dir)) return fail(`deck "${id}" already exists at ${dir}; refusing to overwrite`);
  const folder = resolve(folderArg);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return fail(`folder not found: ${folder}`);

  const images = readdirSync(folder, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith(".") && IMPORT_EXTS.has(extname(d.name).toLowerCase()))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));
  if (!images.length) return fail(`no supported images in ${folder} (expected .png, .jpg, .jpeg or .webp)`);
  if (images.length > MAX_SLIDES) return fail(`${images.length} images in ${folder}; a deck takes at most ${MAX_SLIDES} slides`);

  const pad = images.length > 99 ? 3 : 2;
  const plan = images.map((name, i) => {
    const n = String(i + 1).padStart(pad, "0");
    return { name, slideId: `s${n}`, asset: `assets/slide-${n}${extname(name).toLowerCase()}` };
  });
  const deck: Deck = {
    version: 1,
    title: titleArg ?? basename(folder),
    theme: { preset: "estudio" },
    slides: plan.map((p, i) => ({
      id: p.slideId,
      background: { image: p.asset },
      elements: i === 0 ? [{ id: "qr", type: "qr", box: { x: 0.81, y: 0.66, w: 0.16, h: 0.3 }, style: { background: "#ffffff", color: "#0a0a0a" } }] : [],
      notes: "",
    })),
  };
  const parsed = parseDeck(deck);
  if (!parsed.ok) return fail(`imported deck would be invalid: ${parsed.error}`);

  for (const p of plan) {
    const size = imageSize(readFileSync(join(folder, p.name)));
    if (!size) process.stderr.write(`warning: ${p.name}: could not read image dimensions from the file header\n`);
    else if (!isSixteenByNine(size.width, size.height)) {
      process.stderr.write(`warning: ${p.name} is ${size.width}x${size.height}, not 16:9; it will be letterboxed\n`);
    }
  }

  const file = join(dir, "deck.json");
  try {
    mkdirSync(join(dir, "assets"), { recursive: true });
    for (const p of plan) copyFileSync(join(folder, p.name), join(dir, p.asset));
    writeFileSync(file, `${JSON.stringify(deck, null, 2)}\n`, { flag: "wx" });
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    return fail(`import failed: ${(err as Error).message}`);
  }

  const report = check(file);
  for (const w of report.warnings) process.stderr.write(`warning: ${w}\n`);
  if (report.errors.length || !report.deck) {
    for (const e of report.errors) process.stdout.write(`${e}\n`);
    return 1;
  }
  process.stdout.write(
    `Imported ${file}\n${report.deck.slides.length} slides from ${folder}\nPreview:  /preview/${id}\n` +
      `Next: add speaker notes and quizzes with the live-deck skill, then run: node bin/live-deck.ts validate ${id}\n`,
  );
  return 0;
}

function list(): number {
  if (!existsSync(DECKS_DIR)) {
    process.stderr.write(`decks root not found: ${DECKS_DIR}\n`);
    return 1;
  }
  const ids = readdirSync(DECKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && DECK_ID.test(d.name))
    .map((d) => d.name)
    .sort();
  if (!ids.length) process.stdout.write(`no decks in ${DECKS_DIR}\n`);
  const width = Math.max(0, ...ids.map((id) => id.length));
  for (const id of ids) {
    const report = check(join(DECKS_DIR, id, "deck.json"));
    const name = id.padEnd(width);
    if (report.deck && !report.errors.length) {
      process.stdout.write(`${name}  ${report.deck.slides.length} slides  ${report.deck.title}\n`);
    } else {
      process.stdout.write(`${name}  INVALID  ${report.errors[0] ?? "unknown error"}\n`);
    }
  }
  return 0;
}

function publish(args: string[]): number {
  const dryRun = args.includes("--dry-run");
  const id = args.find((a) => !a.startsWith("--"));
  if (!id || !DECK_ID.test(id)) {
    process.stderr.write(`publish needs a deck id (${DECK_ID.source})\n\n${USAGE}`);
    return 2;
  }
  const target = process.env.LIVE_DECK_PUBLISH_TARGET?.trim().replace(/\/+$/, "");
  if (!target) {
    process.stderr.write("Set LIVE_DECK_PUBLISH_TARGET to where the server reads decks, e.g. user@host:/opt/live-deck/decks (it can live in .env).\n");
    return 2;
  }
  const report = check(join(DECKS_DIR, id, "deck.json"));
  for (const w of report.warnings) process.stderr.write(`warning: ${w}\n`);
  if (report.errors.length || !report.deck) {
    for (const e of report.errors) process.stdout.write(`${e}\n`);
    process.stderr.write(`${id}: not published (fix the errors above)\n`);
    return 1;
  }
  // Trailing slashes: copy the folder's contents into <target>/<id>; --delete stays inside it.
  const rsyncArgs = ["-a", "--delete", "--exclude", ".DS_Store", ...(dryRun ? ["-n", "-v"] : []), `${join(DECKS_DIR, id)}/`, `${target}/${id}/`];
  const run = spawnSync("rsync", rsyncArgs, { stdio: "inherit" });
  if (run.error || run.status !== 0) {
    process.stderr.write(`${id}: rsync failed${run.error ? ` (${run.error.message})` : ` with exit code ${run.status}`}\n`);
    return 1;
  }
  const base = process.env.LIVE_DECK_PUBLIC_URL?.trim().replace(/\/+$/, "");
  process.stdout.write(`${dryRun ? "Dry run, nothing copied:" : "Published"} ${report.deck.title} -> ${target}/${id}\n`);
  if (base && !dryRun) process.stdout.write(`Preview: ${base}/preview/${id}\nCreate the session for the event from ${base}/ (needs the admin key).\n`);
  return 0;
}

function main(argv: string[]): number {
  const [command, ...args] = argv;
  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(USAGE);
      return 0;
    case "validate":
      return validate(args);
    case "new":
      return scaffold(args);
    case "import":
      return importDeck(args);
    case "list":
      return list();
    case "publish":
      return publish(args);
    default:
      process.stderr.write(`unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));

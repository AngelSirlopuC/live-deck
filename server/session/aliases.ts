// Creative anonymous aliases: an Andean/Peruvian-flavoured noun plus an
// adjective that agrees in gender. 40 x 40 = 1600 combinations per session.

type Gender = "m" | "f";

const NOUNS: Array<[string, Gender]> = [
  ["Cóndor", "m"], ["Llama", "f"], ["Vicuña", "f"], ["Alpaca", "f"], ["Puma", "m"],
  ["Colibrí", "m"], ["Jaguar", "m"], ["Oso", "m"], ["Delfín", "m"], ["Pingüino", "m"],
  ["Tortuga", "f"], ["Nutria", "f"], ["Zorro", "m"], ["Lechuza", "f"], ["Tucán", "m"],
  ["Guacamayo", "m"], ["Mariposa", "f"], ["Ballena", "f"], ["Cuy", "m"], ["Vizcacha", "f"],
  ["Gallito", "m"], ["Perezoso", "m"], ["Capibara", "f"], ["Flamenco", "m"], ["Anchoveta", "f"],
  ["Ardilla", "f"], ["Halcón", "m"], ["Lobo", "m"], ["Lagartija", "f"], ["Zorzal", "m"],
  ["Papa", "f"], ["Quinua", "f"], ["Maíz", "m"], ["Cometa", "m"], ["Volcán", "m"],
  ["Nevado", "m"], ["Ola", "f"], ["Brújula", "f"], ["Trompo", "m"], ["Charango", "m"],
];

const ADJECTIVES: Array<[string, string]> = [
  ["Curioso", "Curiosa"], ["Veloz", "Veloz"], ["Sabio", "Sabia"], ["Valiente", "Valiente"],
  ["Despierto", "Despierta"], ["Brillante", "Brillante"], ["Audaz", "Audaz"], ["Sereno", "Serena"],
  ["Risueño", "Risueña"], ["Atento", "Atenta"], ["Inquieto", "Inquieta"], ["Genial", "Genial"],
  ["Cósmico", "Cósmica"], ["Eléctrico", "Eléctrica"], ["Místico", "Mística"], ["Dorado", "Dorada"],
  ["Astuto", "Astuta"], ["Tranquilo", "Tranquila"], ["Ingenioso", "Ingeniosa"], ["Feliz", "Feliz"],
  ["Fugaz", "Fugaz"], ["Legendario", "Legendaria"], ["Intrépido", "Intrépida"], ["Luminoso", "Luminosa"],
  ["Elegante", "Elegante"], ["Creativo", "Creativa"], ["Nocturno", "Nocturna"], ["Andino", "Andina"],
  ["Viajero", "Viajera"], ["Paciente", "Paciente"], ["Alegre", "Alegre"], ["Galáctico", "Galáctica"],
  ["Sigiloso", "Sigilosa"], ["Pensador", "Pensadora"], ["Saltarín", "Saltarina"], ["Bravo", "Brava"],
  ["Soñador", "Soñadora"], ["Vibrante", "Vibrante"], ["Noble", "Noble"], ["Mágico", "Mágica"],
];

export const ALIAS_SPACE = NOUNS.length * ADJECTIVES.length;

function aliasAt(index: number): string {
  const [noun, gender] = NOUNS[index % NOUNS.length]!;
  const [masc, fem] = ADJECTIVES[Math.floor(index / NOUNS.length) % ADJECTIVES.length]!;
  return `${noun} ${gender === "m" ? masc : fem}`;
}

const ROMAN = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Picks an alias not in `taken`. Past the base space it adds a roman suffix (never digits). */
export function pickAlias(taken: ReadonlySet<string>, random: () => number = Math.random): string {
  const start = Math.floor(random() * ALIAS_SPACE);
  for (const suffix of ["", ...ROMAN]) {
    for (let i = 0; i < ALIAS_SPACE; i++) {
      const candidate = suffix ? `${aliasAt(start + i)} ${suffix}` : aliasAt(start + i);
      if (!taken.has(candidate)) return candidate;
    }
  }
  throw new Error("alias space exhausted");
}

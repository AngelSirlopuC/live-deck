// Editor icons in the same family as web/src/ui/icons.ts (24px grid, 2px
// stroke, round joins). Authored inline so the chrome never shows glyphs.
const PATHS = {
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  duplicate: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  shape: '<rect x="3" y="3" width="10" height="10" rx="1.5"/><circle cx="16" cy="16" r="5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-3"/>',
  decor: '<path d="M12 3c2 3 7 4 7 9a7 7 0 0 1-14 0c0-5 5-6 7-9z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
  line: '<path d="M4 20 20 4"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  backward: '<rect x="4" y="4" width="12" height="12" rx="1.5"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  warning: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17v.01"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  alignLeft: '<path d="M4 3v18"/><rect x="7" y="6" width="13" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>',
  alignCenterX: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignRight: '<path d="M20 3v18"/><rect x="4" y="6" width="13" height="4" rx="1"/><rect x="9" y="14" width="8" height="4" rx="1"/>',
  alignTop: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="13" rx="1"/><rect x="14" y="7" width="4" height="8" rx="1"/>',
  alignCenterY: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignBottom: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="13" rx="1"/><rect x="14" y="9" width="4" height="8" rx="1"/>',
  distributeX: '<path d="M3 3v18M21 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distributeY: '<path d="M3 3h18M3 21h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  slides: '<rect x="3" y="4" width="14" height="11" rx="1.5"/><path d="M7 19h11a2 2 0 0 0 2-2V8"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5M12 17v.01"/>',
  ask: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M8 12h8"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15.5" cy="7.5" r="1"/>',
  fragment: '<path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="9"/>',
} as const;

export type EdIconName = keyof typeof PATHS;

export function edIcon(name: EdIconName, label?: string): string {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${PATHS[name]}</svg>`;
}

// Objects drawn in the shop's own line: the same 1.7 stroke and round ends as the icon set, on a 48 grid.
const GLYPHS = {
  bottle: (
    <>
      <path d="M20 6h8v5l3 4v25a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V15l3-4z" />
      <path d="M17 22h14" />
      <path d="M17 32h14" />
      <path d="M36 10v12M33 13h6" />
    </>
  ),
  drill: (
    <>
      <path d="M8 14h24a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H8z" />
      <path d="M36 19h7" />
      <path d="M14 24l-2 16h9l3-16" />
      <path d="M12 32h8" />
      <circle cx="20" cy="19" r="1.5" />
    </>
  ),
  plug: (
    <>
      <path d="M15 17h18v9a9 9 0 0 1-18 0z" />
      <path d="M19 17V8M29 17V8" />
      <path d="M24 35v8" />
      <path d="M21 25h6" />
    </>
  ),
  bowl: (
    <>
      <path d="M6 26h36l-4 12a4 4 0 0 1-4 3H14a4 4 0 0 1-4-3z" />
      <path d="M17 18c-3 0-3-4 0-4 0-3 4-3 4 0h6c0-3 4-3 4 0 3 0 3 4 0 4 0 3-4 3-4 0h-6c0 3-4 3-4 0z" />
    </>
  ),
  leaf: (
    <>
      <path d="M10 38C10 20 22 9 40 8c-1 18-12 30-30 30z" />
      <path d="M10 38l16-16" />
      <path d="M20 29h7M25 24v-6" />
    </>
  ),
  rail: (
    <>
      <path d="M8 40h32" />
      <path d="M14 40V18a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v22" />
      <path d="M14 26h20" />
      <path d="M20 12V8M28 12V8" />
    </>
  ),
  spray: (
    <>
      <path d="M16 18h12v4l3 5v13a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V27l3-5z" />
      <path d="M18 18v-6h9l6 3-2 3" />
      <path d="M37 11l4-2M37 15h5M37 19l4 2" />
    </>
  ),
  tap: (
    <>
      <path d="M10 22h14a6 6 0 0 1 6 6v3" />
      <path d="M17 22v-7M12 15h10" />
      <path d="M30 36v1M30 41v1" />
      <path d="M6 22v-2h4v2" />
    </>
  ),
  shirt: (
    <>
      <path d="M17 7l-9 5 3 9 5-2v21h16V19l5 2 3-9-9-5c-1 3-4 5-7 5s-6-2-7-5z" />
    </>
  ),
  mirror: (
    <>
      <ellipse cx="24" cy="18" rx="10" ry="12" />
      <path d="M24 30v10M17 41h14" />
      <path d="M19 14c1-3 3-4 5-4" />
    </>
  ),
  box: (
    <>
      <path d="M8 16l16-8 16 8v18l-16 8-16-8z" />
      <path d="M8 16l16 8 16-8M24 24v18" />
      <path d="M16 12l16 8" />
    </>
  ),
  basket: (
    <>
      <path d="M7 19h34l-4 20a3 3 0 0 1-3 2H14a3 3 0 0 1-3-2z" />
      <path d="M16 19l6-11M32 19l-6-11" />
      <path d="M18 26v9M24 26v9M30 26v9" />
    </>
  ),
  door: (
    <>
      <path d="M14 41V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v32" />
      <path d="M8 41h32" />
      <path d="M29 25v2" />
      <path d="M19 13h10v8H19z" />
    </>
  ),
};

const MATCH = [
  [/beauty|hair|skin|make ?up|cosmetic|health/i, 'bottle'],
  [/mirror/i, 'mirror'],
  [/diy|tool|hardware|parts|fix|repair/i, 'drill'],
  [/electr|audio|phone|charger|tech|cable/i, 'plug'],
  [/pet|dog|cat|animal/i, 'bowl'],
  [/garden|pond|outdoor|plant/i, 'leaf'],
  [/care|mobility|elderly|disab|aid/i, 'rail'],
  [/bath|shower|plumb/i, 'tap'],
  [/clean|house|home|kitchen|pest/i, 'spray'],
  [/cloth|fashion|bag|wear|robe/i, 'shirt'],
];

export const glyphFor = (name = '') => (MATCH.find(([re]) => re.test(name)) ?? [null, 'box'])[1];

export function SectionGlyph({ name, kind, size = 48, className }) {
  const key = kind ?? glyphFor(name);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[key] ?? GLYPHS.box}
    </svg>
  );
}

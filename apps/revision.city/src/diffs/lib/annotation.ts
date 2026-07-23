import { css } from 'styled-system/css';

export const annotationCardBase = css({
  m: '2',
  display: 'flex',
  maxW: '600px',
  gap: '2.5',
  rounded: 'diffs.xl',
  borderWidth: '1px',
  borderColor: 'var(--diffs-annotation-border, var(--border))',
  bg: 'var(--diffs-annotation-bg, var(--card))',
  backgroundClip: 'padding-box',
  p: '3',
  fontFamily: 'diffs.sans',
  color: 'var(--diffs-annotation-fg, var(--card-foreground))',
  boxShadow:
    'var(--diffs-annotation-shadow, 0 2px 4px rgb(0 0 0 / 0.025), 0 4px 8px rgb(0 0 0 / 0.025))',
});

// All available reviewer personas. Purely local identities used to give draft
// and saved comments a stable name/color; no avatar images are shipped.
const PERSONA_NAMES = [
  'ada',
  'bay',
  'cam',
  'dot',
  'eli',
  'fern',
  'gus',
  'ivy',
  'jules',
  'kit',
  'lee',
  'max',
  'nova',
  'oak',
  'pax',
  'quinn',
  'rey',
  'sky',
  'tam',
] as const;

// Avatar backgrounds personas hash into; distinguishable in light and dark.
const PERSONA_COLORS = [
  '#0e7490',
  '#15803d',
  '#a16207',
  '#b91c1c',
  '#7e22ce',
  '#1d4ed8',
  '#be185d',
  '#4d7c0f',
  '#b45309',
  '#0f766e',
] as const;

export type AvatarName = (typeof PERSONA_NAMES)[number];

export interface Persona {
  name: AvatarName;
  color: string;
  initial: string;
}

function buildPersona(name: AvatarName): Persona {
  return {
    name,
    color: PERSONA_COLORS[djb2Hash(name) % PERSONA_COLORS.length],
    initial: name[0].toUpperCase(),
  };
}

function djb2Hash(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Picks a random persona from the list. Intended for use as a useState lazy
// initializer so each new draft form gets a fresh identity on mount.
export function getRandomPersona(): Persona {
  const name = PERSONA_NAMES[Math.floor(Math.random() * PERSONA_NAMES.length)];
  return buildPersona(name);
}

// Returns a persona for the given name or seed. If the seed is an exact
// persona name (i.e. it was stored directly from getRandomPersona), returns
// that persona directly so draft and saved annotations stay in sync. Otherwise
// falls back to a djb2 hash to spread arbitrary comment keys across the list.
export function getCommentPersona(seed: string): Persona {
  if (PERSONA_NAMES.includes(seed as AvatarName)) {
    return buildPersona(seed as AvatarName);
  }
  return buildPersona(PERSONA_NAMES[djb2Hash(seed) % PERSONA_NAMES.length]);
}

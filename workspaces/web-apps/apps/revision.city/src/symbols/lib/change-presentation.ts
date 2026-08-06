import type {EntityChangeType, EntityKind} from './entity'

export interface ChangeStyle {
  readonly color: string
  readonly label: string
  readonly sigil: string
}

// Sigil, label and color per change bucket. Both the letters and the colors are
// the file tree's Git-status vocabulary, so a symbol row and a file row mean the
// same thing by the same mark -- `M` is modified in both. Moved has no Git-status
// counterpart, so it takes an arrow rather than stealing a letter.
export const CHANGE_STYLES: Record<EntityChangeType, ChangeStyle> = {
  added: {color: 'light-dark(#16a994, #00cab1)', label: 'added', sigil: 'A'},
  modified: {color: 'light-dark(#1ca1c7, #08c0ef)', label: 'modified', sigil: 'M'},
  renamed: {color: 'light-dark(#d5a910, #ffd452)', label: 'renamed', sigil: 'R'},
  moved: {color: 'light-dark(#d5a910, #ffd452)', label: 'moved', sigil: '→'},
  deleted: {color: 'light-dark(#ff2e3f, #ff6762)', label: 'deleted', sigil: 'D'},
}

// Bucket order for the summary line, matching how the rows themselves sort.
export const CHANGE_ORDER: readonly EntityChangeType[] = [
  'added',
  'modified',
  'renamed',
  'moved',
  'deleted',
]

// Short kind labels, so a row reads "fn parseUrl" rather than spelling out each
// grammar's own vocabulary.
export const KIND_LABELS: Record<EntityKind, string> = {
  class: 'class',
  constant: 'const',
  constructor: 'ctor',
  enum: 'enum',
  field: 'field',
  function: 'fn',
  heading: 'heading',
  impl: 'impl',
  interface: 'interface',
  macro: 'macro',
  method: 'method',
  mixin: 'mixin',
  module: 'module',
  property: 'key',
  rule: 'rule',
  struct: 'struct',
  trait: 'trait',
  type: 'type',
  variable: 'var',
}

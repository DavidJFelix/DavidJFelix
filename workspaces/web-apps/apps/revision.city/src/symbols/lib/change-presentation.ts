import type {EntityChangeType, EntityKind} from './entity'

export interface ChangeStyle {
  readonly color: string
  readonly label: string
  readonly sigil: string
}

// Sigil, label and color per change bucket. The colors are the file tree's
// Git-status palette, so "added" reads the same in both panels.
export const CHANGE_STYLES: Record<EntityChangeType, ChangeStyle> = {
  added: {color: 'light-dark(#16a994, #00cab1)', label: 'Added', sigil: '+'},
  modified: {color: 'light-dark(#1ca1c7, #08c0ef)', label: 'Modified', sigil: '~'},
  renamed: {color: 'light-dark(#d5a910, #ffd452)', label: 'Renamed', sigil: 'R'},
  moved: {color: 'light-dark(#d5a910, #ffd452)', label: 'Moved', sigil: 'M'},
  deleted: {color: 'light-dark(#ff2e3f, #ff6762)', label: 'Deleted', sigil: '-'},
}

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

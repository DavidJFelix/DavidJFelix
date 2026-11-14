import type {SyntaxNode} from '@lezer/common'

import type {ResolveEntityNameParams} from '../entity'

export interface WrapperChildrenOptions {
  wrapper: string
  type: string
}

// A `leading` function for grammars that wrap a declaration and its decorators
// in one parent: Python `DecoratedStatement`, Rust `AttributeItem`. It returns
// the parent's children of `type` when the parent is a `wrapper`.
export function wrapperChildren({
  wrapper,
  type,
}: WrapperChildrenOptions): (params: ResolveEntityNameParams) => readonly SyntaxNode[] {
  return ({node}) => (node.parent?.type.name === wrapper ? node.parent.getChildren(type) : [])
}

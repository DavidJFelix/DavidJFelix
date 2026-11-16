import type {SyntaxNode} from '@lezer/common'
import {parser as jsonGrammar} from '@lezer/json'
import {parser as yamlGrammar} from '@lezer/yaml'

import type {ResolveSymbolNameParams, SymbolSpec} from '../code-symbol'
import {symbolProp} from '../code-symbol'

// Data formats earn symbol tracking because config diffs are where line-based
// review is weakest: `dependencies.react` changing is the fact a reviewer wants,
// not that line 47 moved.
function resolveQuotedKey({node, source}: ResolveSymbolNameParams): string | undefined {
  const key = node.getChild('PropertyName')
  if (key === null) {
    return undefined
  }
  return source.slice(key.from, key.to).replaceAll(/^"|"$/gu, '')
}

// Everything else inside an Array node is punctuation, or the error node a
// JSONC comment parses to.
const JSON_VALUE_TYPES = new Set(['Array', 'False', 'Null', 'Number', 'Object', 'String', 'True'])

function resolveArrayElements({node}: ResolveSymbolNameParams): readonly SyntaxNode[] | undefined {
  const array = node.getChild('Array')
  if (array === null) {
    return undefined
  }
  const elements: SyntaxNode[] = []
  for (let child = array.firstChild; child !== null; child = child.nextSibling) {
    if (JSON_VALUE_TYPES.has(child.type.name)) {
      elements.push(child)
    }
  }
  return elements
}

const JSON_SPECS: Record<string, SymbolSpec> = {
  Property: {
    kind: 'property',
    resolveName: resolveQuotedKey,
    container: true,
    resolveSequence: resolveArrayElements,
  },
}

const YAML_SPECS: Record<string, SymbolSpec> = {
  Pair: {kind: 'property', name: ['Key'], container: true},
}

export const jsonParser = jsonGrammar.configure({props: [symbolProp.add(JSON_SPECS)]})
export const yamlParser = yamlGrammar.configure({props: [symbolProp.add(YAML_SPECS)]})

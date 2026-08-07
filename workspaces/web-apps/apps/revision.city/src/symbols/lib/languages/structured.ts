import type {SyntaxNode} from '@lezer/common'
import {parser as jsonGrammar} from '@lezer/json'
import {parser as yamlGrammar} from '@lezer/yaml'

import type {EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// Data formats earn entity tracking because config diffs are where line-based
// review is weakest: `dependencies.react` changing is the fact a reviewer wants,
// not that line 47 moved.
function resolveQuotedKey({node, source}: ResolveEntityNameParams): string | undefined {
  const key = node.getChild('PropertyName')
  if (key === null) {
    return undefined
  }
  return source.slice(key.from, key.to).replaceAll(/^"|"$/gu, '')
}

// Everything else inside an Array node is punctuation, or the error node a
// JSONC comment parses to.
const JSON_VALUE_TYPES = new Set(['Array', 'False', 'Null', 'Number', 'Object', 'String', 'True'])

function resolveArrayElements({node}: ResolveEntityNameParams): readonly SyntaxNode[] | undefined {
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

const JSON_SPECS: Record<string, EntitySpec> = {
  Property: {
    kind: 'property',
    resolveName: resolveQuotedKey,
    container: true,
    resolveSequence: resolveArrayElements,
  },
}

const YAML_SPECS: Record<string, EntitySpec> = {
  Pair: {kind: 'property', name: ['Key'], container: true},
}

export const jsonParser = jsonGrammar.configure({props: [entityProp.add(JSON_SPECS)]})
export const yamlParser = yamlGrammar.configure({props: [entityProp.add(YAML_SPECS)]})

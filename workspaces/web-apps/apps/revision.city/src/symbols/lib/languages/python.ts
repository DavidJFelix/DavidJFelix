import {parser} from '@lezer/python'

import type {SymbolSpec} from '../code-symbol'
import {symbolProp} from '../code-symbol'
import {wrapperChildren} from './wrapper-children'

const decorators = wrapperChildren({wrapper: 'DecoratedStatement', type: 'Decorator'})

const SPECS: Record<string, SymbolSpec> = {
  FunctionDefinition: {
    kind: 'function',
    name: ['VariableName'],
    container: true,
    leading: decorators,
  },
  ClassDefinition: {kind: 'class', name: ['VariableName'], container: true, leading: decorators},
  // Module-level and class-level bindings only -- `scope` drops assignments
  // made inside function bodies.
  AssignStatement: {kind: 'constant', name: ['VariableName'], scope: 'top-level'},
}

export const pythonParser = parser.configure({props: [symbolProp.add(SPECS)]})

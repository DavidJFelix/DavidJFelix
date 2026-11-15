import {parser} from '@lezer/python'

import type {EntitySpec} from '../entity'
import {entityProp} from '../entity'
import {wrapperChildren} from './wrapper-children'

const decorators = wrapperChildren({wrapper: 'DecoratedStatement', type: 'Decorator'})

const SPECS: Record<string, EntitySpec> = {
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

export const pythonParser = parser.configure({props: [entityProp.add(SPECS)]})

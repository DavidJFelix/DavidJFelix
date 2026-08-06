import type {Parser} from '@lezer/common'
import {expect, test} from 'vitest'

import {extractEntities} from './extract-entities'
import {LANGUAGES} from './language-registry'

// Resolved through the registry rather than imported directly, so these cases
// also prove each language is reachable the way the differ reaches it.
function parserFor(id: string): Promise<Parser> {
  const language = LANGUAGES.find((entry) => entry.id === id)
  if (language === undefined) {
    throw new Error(`No language registered for ${id}`)
  }
  return language.loadParser()
}

const tsxParser = await parserFor('tsx')
const markdownParser = await parserFor('markdown')
const jsonParser = await parserFor('json')

interface ExtractionCase {
  readonly language: string
  readonly source: string
  readonly expected: readonly string[]
}

const CASES: readonly ExtractionCase[] = [
  {
    language: 'tsx',
    source: `export interface Options {timeout: number}
export type Result = string | null
export enum Level {Info}
export function greet(name: string) {
  const local = 1
  return local
}
export const double = (value: number) => value * 2
export const LIMIT = 10
export class Widget {
  #count = 0
  constructor() {}
  render() { return null }
}
namespace Utils {
  export function inner() {}
}
`,
    expected: [
      'interface Options',
      'type Result',
      'enum Level',
      'function greet',
      'function double',
      'constant LIMIT',
      'class Widget',
      'property Widget.#count',
      'constructor Widget.constructor',
      'method Widget.render',
      'module Utils',
      'function Utils.inner',
    ],
  },
  {
    language: 'python',
    source: `CONST = 3
def greet(name):
    local = 1
    return local
class Widget(Base):
    attr = 1
    def method(self):
        pass
`,
    expected: [
      'constant CONST',
      'function greet',
      'class Widget',
      'constant Widget.attr',
      'function Widget.method',
    ],
  },
  {
    language: 'rust',
    source: `pub struct Widget {field: u32}
pub enum Color {Red}
pub trait Draw {fn draw(&self);}
impl Draw for Widget {fn draw(&self) {}}
pub fn make() -> Widget {Widget {field: 0}}
mod inner {pub const X: u32 = 1;}
type Alias = u32;
`,
    expected: [
      'struct Widget',
      'enum Color',
      'trait Draw',
      'function Draw.draw',
      'impl Widget',
      'function Widget.draw',
      'function make',
      'module inner',
      'constant inner.X',
      'type Alias',
    ],
  },
  {
    language: 'go',
    source: `package main
type Widget struct {Field int}
type Draw interface {Draw()}
const Pi = 3.14
var Global = 1
func Make() *Widget {return nil}
func (w *Widget) Method() int {return 0}
`,
    expected: [
      'struct Widget',
      'interface Draw',
      'constant Pi',
      'variable Global',
      'function Make',
      'method Method',
    ],
  },
  {
    language: 'java',
    source: `public class Widget {
  private int count;
  public Widget() {}
  public int getCount() {return count;}
}
interface Draw {void draw();}
enum Color {RED}
`,
    expected: [
      'class Widget',
      'field Widget.count',
      'constructor Widget.Widget',
      'method Widget.getCount',
      'interface Draw',
      'method Draw.draw',
      'enum Color',
    ],
  },
  {
    language: 'cpp',
    source: `namespace ns {
struct Widget {int field; void method();};
enum Color {Red};
int make(int a) {return a;}
using Alias = int;
}
`,
    expected: [
      'module ns',
      'struct ns.Widget',
      'field ns.Widget.field',
      'method ns.Widget.method',
      'enum ns.Color',
      'function ns.make',
      'type ns.Alias',
    ],
  },
  {
    language: 'php',
    source: `<?php
const VERSION = '1';
function greet(string $n) {return $n;}
class Widget {
  public int $count = 0;
  public function __construct() {}
  public function render() {return '';}
}
interface Draw {public function draw();}
trait Logger {public function log() {}}
`,
    expected: [
      'constant VERSION',
      'function greet',
      'class Widget',
      'property Widget.$count',
      'constructor Widget.__construct',
      'method Widget.render',
      'interface Draw',
      'method Draw.draw',
      'trait Logger',
      'method Logger.log',
    ],
  },
  {
    language: 'css',
    source: `.button, .btn {color: red;}
#id > .child::before {content: '';}
@keyframes spin {from {opacity: 0}}
`,
    expected: ['rule .button, .btn', 'rule #id > .child::before', 'rule spin'],
  },
  {
    language: 'sass',
    source: `@mixin center {display: flex;}
.button {color: red;}
`,
    expected: ['mixin center', 'rule .button'],
  },
  {
    language: 'markdown',
    source: `# Title

Body text.

## Section ##

### Sub
`,
    expected: ['heading Title', 'heading Section', 'heading Sub'],
  },
  {
    language: 'json',
    source: `{"name": "app", "dependencies": {"react": "19"}}`,
    expected: ['property name', 'property dependencies', 'property dependencies.react'],
  },
  {
    language: 'yaml',
    source: `name: build
jobs:
  test:
    runs-on: ubuntu
`,
    expected: [
      'property name',
      'property jobs',
      'property jobs.test',
      'property jobs.test.runs-on',
    ],
  },
]

test.each(CASES)('extracts entities from $language', async ({language, source, expected}) => {
  const entities = extractEntities({source, parser: await parserFor(language)})

  expect(entities.map((entity) => `${entity.kind} ${entity.qualifiedName}`)).toEqual(expected)
})

test('reports 1-based line ranges spanning the whole entity', () => {
  const source = 'const a = 1\nfunction greet() {\n  return 1\n}\n'

  const entities = extractEntities({source, parser: tsxParser})

  expect(entities.find((entity) => entity.name === 'greet')?.range).toEqual({
    startLine: 2,
    endLine: 4,
  })
})

test('disambiguates same-named siblings with an ordinal suffix', () => {
  const source = '# Notes\n\n## Notes\n'

  const entities = extractEntities({source, parser: markdownParser})

  expect(entities.map((entity) => entity.qualifiedName)).toEqual(['Notes', 'Notes#2'])
})

test('ignores locals declared inside a function body', () => {
  const source = 'export function outer() {\n  const hidden = 1\n  return hidden\n}\n'

  const entities = extractEntities({source, parser: tsxParser})

  expect(entities.map((entity) => entity.name)).toEqual(['outer'])
})

test('parses a file with syntax errors instead of throwing', () => {
  const source = 'export function broken( {\n  return\n'

  const entities = extractEntities({source, parser: tsxParser})

  expect(entities.map((entity) => entity.name)).toContain('broken')
})

test('fingerprints the elements of an array-valued property', () => {
  const source = '{"words": ["alpha", "beta"], "limit": 3}'

  const entities = extractEntities({source, parser: jsonParser})

  const words = entities.find((entity) => entity.qualifiedName === 'words')
  expect(words?.elements?.map((element) => element.preview)).toEqual(['"alpha"', '"beta"'])
  expect(words?.elements?.map((element) => element.hasEntities)).toEqual([false, false])
  expect(entities.find((entity) => entity.qualifiedName === 'limit')?.elements).toBeUndefined()
})

test('marks array elements that contain entities of their own', () => {
  const source = '{"defs": [{"name": "dns"}, "plain"]}'

  const entities = extractEntities({source, parser: jsonParser})

  const defs = entities.find((entity) => entity.qualifiedName === 'defs')
  expect(defs?.elements?.map((element) => element.hasEntities)).toEqual([true, false])
})

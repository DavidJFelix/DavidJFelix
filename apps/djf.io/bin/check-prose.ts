#!/usr/bin/env bun
// Guards blog prose against em-dashes and curly quotes.
// David's rule: straight quotes only, and no em-dashes ever. These are
// punctuation rather than words, so the check lives here instead of in cspell.
import {Glob} from 'bun'

const FORBIDDEN = [
  {code: '—', name: 'em-dash'},
  {code: '‘', name: 'curly single quote (open)'},
  {code: '’', name: 'curly single quote (close)'},
  {code: '“', name: 'curly double quote (open)'},
  {code: '”', name: 'curly double quote (close)'},
]

const glob = new Glob('src/content/**/*.md')
let violations = 0

for (const path of glob.scanSync('.')) {
  const lines = (await Bun.file(path).text()).split('\n')
  lines.forEach((line, lineIndex) => {
    for (const {code, name} of FORBIDDEN) {
      for (let col = line.indexOf(code); col !== -1; col = line.indexOf(code, col + 1)) {
        console.error(`${path}:${lineIndex + 1}:${col + 1}  ${name}`)
        violations += 1
      }
    }
  })
}

if (violations > 0) {
  console.error(`\n${violations} prose violation(s): use straight quotes and no em-dashes.`)
  process.exit(1)
}

console.log('prose check passed: no em-dashes or curly quotes in blog content')

import fs from 'fs'
import _, { max, min } from 'lodash'

const input = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n')
  .map((line) => parseInt(line))

function extractPreambles(list: number[]): [number, number[]][] {
  const codeList = list.slice(25)
  const preambleList = list
    .map((_, index, list) => list.slice(index, index + 25))
    .slice(0, codeList.length)
  return _.zip(codeList, preambleList) as [number, number[]][]
}

function generatePreambleSumSet(preamble: number[]): Set<number> {
  return new Set(
    preamble
      .flatMap((left, i, list) =>
        list.slice(i + 1).map((right) => [left, right]),
      )
      .map((pair) => pair.reduce((a, b) => a + b)),
  )
}

const [incorrectValue] = extractPreambles(input)
  .map(
    ([val, preamble]) =>
      [val, generatePreambleSumSet(preamble)] as [number, Set<number>],
  )
  .find(([val, preambleSet]) => !preambleSet.has(val)) as [number, Set<number>]

// Part 1
console.log(incorrectValue)

function breakIncorrectValue(
  input: number[],
  incorrectValue: number,
): number | undefined {
  for (let first = 0; first < input.length - 1; first++) {
    for (let second = first + 1; second < input.length; second++) {
      let seq = input.slice(first, second)
      let sum = seq.reduce((a, b) => a + b)
      if (sum === incorrectValue) {
        return min(seq)! + max(seq)!
      }
    }
  }
}

// Part 2
console.log(breakIncorrectValue(input, incorrectValue))

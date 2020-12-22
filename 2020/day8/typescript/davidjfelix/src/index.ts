import fs from 'fs'
import _, { slice } from 'lodash'

const input: [string, number][] = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n')
  .map((instruction) => instruction.split(' '))
  .map(([operation, value]) => [operation, parseInt(value)])

interface ProgramResult {
  didTerminate: boolean
  accumulator: number
}
function runProgram(instructions: [string, number][]): ProgramResult {
  const visitedInstructions: Set<number> = new Set()
  let accumulator = 0
  let instructionCursor = 0
  let isProgramNormal = true

  while (instructionCursor < input.length) {
    if (visitedInstructions.has(instructionCursor)) {
      isProgramNormal = false
      break
    }
    visitedInstructions.add(instructionCursor)
    const [operation, value] = instructions[instructionCursor]
    switch (operation) {
      case 'acc':
        accumulator += value
      case 'nop':
        instructionCursor += 1
        break
      case 'jmp':
        instructionCursor += value
    }
  }
  return { accumulator, didTerminate: isProgramNormal }
}

const { accumulator } = runProgram(input)

// Part 1
console.log(accumulator)

const { accumulator: accumulator2 } = input
  .map(([operation, value], index, program) =>
    operation === 'nop'
      ? [
          ...program.slice(0, index),
          ['jmp', value] as [string, number],
          ...program.slice(index + 1),
        ]
      : operation === 'jmp'
      ? [
          ...program.slice(0, index),
          ['nop', value] as [string, number],
          ...program.slice(index + 1),
        ]
      : [],
  )
  .filter((program) => !_.isEmpty(program))
  .map((program) => runProgram(program))
  .find(({ didTerminate }) => didTerminate) as ProgramResult

// Part 2
console.log(accumulator2)

import fs from 'fs'

const input = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n')
  .map((inputs) => inputs.split(/[\s:-]+/) as [string, string, string, string])

const part1 = input
  .map(([min, max, letter, password]) => ({
    min: parseInt(min),
    max: parseInt(max),
    letter,
    password,
  }))
  .filter(({ min, max, letter, password }) => {
    const letterCount = password.split('').filter((it) => it === letter).length
    return letterCount >= min && letterCount <= max
  }).length

console.log(part1)

const part2 = input
  .map(([position1, position2, letter, password]) => ({
    position1: parseInt(position1),
    position2: parseInt(position2),
    letter,
    password,
  }))
  .filter(({ position1, position2, letter, password }) => {
    const hasPosition1 = password[position1 - 1] === letter
    const hasPosition2 = password[position2 - 1] === letter

    return (hasPosition1 && !hasPosition2) || (!hasPosition1 && hasPosition2)
  }).length

console.log(part2)

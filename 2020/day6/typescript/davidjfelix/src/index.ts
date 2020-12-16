import { group } from 'console'
import fs from 'fs'
import _ from 'lodash'

const input = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n\n')
  .map((block) => block.split('\n'))

const totalDeclaredItems = input
  .map((group) => group.join(''))
  .map((group) => Array.from(new Set(group)).length)
  .reduce((a, b) => a + b)

// Part 1
console.log(totalDeclaredItems)

const totalGroupDeclaredItems = input
  .map(
    (group) =>
      group
        .map((person) => person.split(''))
        .reduce((previous, current) =>
          previous.filter((it) => current.includes(it)),
        ).length,
  )
  .reduce((a, b) => a + b)

// Part 2
console.log(totalGroupDeclaredItems)

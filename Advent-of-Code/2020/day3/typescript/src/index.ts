import fs from 'fs'

const input = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n')
  .map((line) => line.split(''))

function countTrees(map: string[][], right: number, down: number) {
  let [x, y, treeCount] = [0, 0, 0]

  while (y < map.length) {
    if (map[y][x % map[0].length] === '#') {
      treeCount += 1
    }
    y += down
    x += right
  }
  return treeCount
}

// Part 1
console.log(countTrees(input, 3, 1))

// Part 2
console.log(
  [
    countTrees(input, 1, 1),
    countTrees(input, 3, 1),
    countTrees(input, 5, 1),
    countTrees(input, 7, 1),
    countTrees(input, 1, 2),
  ].reduce((a, b) => a * b),
)

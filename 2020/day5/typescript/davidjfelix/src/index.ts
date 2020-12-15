import fs from 'fs'
import _ from 'lodash'

const input = fs.readFileSync('./input.txt', 'utf8').split('\n')

const passes = input
  .map((pass) => [pass.slice(0, 7), pass.slice(-3)])
  .map(([row, col]) => [
    row.replaceAll('F', '0').replaceAll('B', '1'),
    col.replaceAll('L', '0').replaceAll('R', '1'),
  ])
  .map(([row, col]) => [parseInt(row, 2), parseInt(col, 2)])

const seatIds = passes.map(([row, col]) => row * 8 + col)

// Part 1
console.log(Math.max(...seatIds))

const sortedSeatIds = seatIds.sort()
const { yourSeatId } = seatIds
  .slice(0)
  .reduce(({ prev, yourSeatId }, current, _i, arr) => {
    if (!_.isUndefined(yourSeatId)) {
      arr.splice(1)
      return { prev, yourSeatId }
    } else if (!_.isUndefined(prev) && prev + 1 !== current) {
      return { prev, yourSeatId: prev + 1 }
    } else {
      return { prev: current }
    }
  }, {} as { prev?: number; yourSeatId?: number })

// Part 2
console.log(yourSeatId)

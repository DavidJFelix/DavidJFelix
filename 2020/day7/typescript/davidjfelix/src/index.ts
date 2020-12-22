import fs from 'fs'
import _, { reduce } from 'lodash'

const input = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n')
  .map((line) => {
    const [outer, ...contents] = line.slice(0, -1).split(/ contain |, /)
    return {
      outer,
      contents: contents.filter((bag) => bag !== 'no other bags'),
    }
  })
  .map(({ outer, contents }) => ({
    outer: outer.replace(/ bags?/, ''),
    contents: contents.map((bag) => {
      const [count, type] = bag.replace(/ bags?/, '').split(/ (.+)/)
      return { count: parseInt(count), type }
    }),
  }))

const invertedGraph = input
  .map((bag) => bag.contents.map(({ type }) => [type, bag.outer]))
  .flatMap((it) => it)
  .reduce(
    (previousValue, [inner, outer]) => ({
      ...previousValue,
      [inner]: [..._.get(previousValue, inner, []), outer],
    }),
    {} as Record<string, string[]>,
  )

interface DepthExpandParams {
  graph: Record<string, string[]>
  key: string
}
function depthExpand({ graph, key }: DepthExpandParams): string[] {
  return _.get(graph, key, [] as string[]).reduce(
    (accumulator, key) => [...accumulator, key, ...depthExpand({ graph, key })],
    [] as string[],
  )
}

// Deduplicate
const bags = Array.from(
  new Set(depthExpand({ graph: invertedGraph, key: 'shiny gold' })),
)

// Part 1
console.log(bags.length)

const graph = Object.fromEntries(
  input.map(({ outer, contents }) => [
    outer,
    contents.reduce(
      (accumulator, { count, type }) => ({ ...accumulator, [type]: count }),
      {} as Record<string, number>,
    ),
  ]),
)

interface DepthCountBagsParams {
  graph: Record<string, Record<string, number>>
  key: string
  multiplier: number
}
function depthCountBags({
  graph,
  key,
  multiplier,
}: DepthCountBagsParams): number {
  return Object.entries(_.get(graph, key, {} as Record<string, number>)).reduce(
    (accumulator, [bag, count]: [string, number]) =>
      accumulator +
      multiplier *
        (count + depthCountBags({ graph, key: bag, multiplier: count })),
    0,
  )
}

// Part 2
console.log(depthCountBags({ graph, key: 'shiny gold', multiplier: 1 }))

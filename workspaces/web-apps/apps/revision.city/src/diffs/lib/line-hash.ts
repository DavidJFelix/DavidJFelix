import type {CodeViewLineSelection, SelectedLineRange, SelectionSide} from '@pierre/diffs'
import {isNullish} from './nullish'

interface LineHashPoint {
  lineNumber: number
  side: SelectionSide
}

export interface DiffsLineHashTarget {
  itemId: string
  range: SelectedLineRange
}

const LINE_POINT_PATTERN = /^([AD])(\d+)$/

export function parseDiffsLineHash(hash: string): DiffsLineHashTarget | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash
  if (text.length === 0) {
    return null
  }

  const params = new URLSearchParams(text)
  const itemId = params.get('target')
  const startPoint = parseLineHashPoint(params.get('start'))
  if (isNullish(itemId) || itemId.length === 0 || isNullish(startPoint)) {
    return null
  }

  const endParam = params.get('end')
  const endPoint = isNullish(endParam) ? startPoint : parseLineHashPoint(endParam)
  if (isNullish(endPoint)) {
    return null
  }

  return {
    itemId,
    range: createSelectedLineRange(startPoint, endPoint),
  }
}

export function formatDiffsLineHash(selection: CodeViewLineSelection): string | null {
  if (selection.id.length === 0) {
    return null
  }

  const startPoint = createLineHashPoint(selection.range.start, selection.range.side)
  const endPoint = createLineHashPoint(
    selection.range.end,
    selection.range.endSide ?? selection.range.side,
  )
  if (isNullish(startPoint) || isNullish(endPoint)) {
    return null
  }

  const params = [
    `target=${encodeHashValue(selection.id)}`,
    `start=${formatLineHashPoint(startPoint)}`,
  ]
  if (!areLineHashPointsEqual(startPoint, endPoint)) {
    params.push(`end=${formatLineHashPoint(endPoint)}`)
  }

  return `#${params.join('&')}`
}

function parseLineHashPoint(value: string | null): LineHashPoint | null {
  if (isNullish(value)) {
    return null
  }

  const match = LINE_POINT_PATTERN.exec(value)
  if (isNullish(match)) {
    return null
  }

  const side = parseLineHashSide(match[1])
  const lineNumber = Number.parseInt(match[2] ?? '', 10)
  if (isNullish(side) || !Number.isSafeInteger(lineNumber) || lineNumber < 1) {
    return null
  }

  return {lineNumber, side}
}

function parseLineHashSide(value: string | undefined): SelectionSide | null {
  switch (value) {
    case 'A':
      return 'additions'
    case 'D':
      return 'deletions'
    default:
      return null
  }
}

function createSelectedLineRange(
  startPoint: LineHashPoint,
  endPoint: LineHashPoint,
): SelectedLineRange {
  return {
    start: startPoint.lineNumber,
    side: startPoint.side,
    end: endPoint.lineNumber,
    ...(startPoint.side !== endPoint.side ? {endSide: endPoint.side} : {}),
  }
}

function createLineHashPoint(
  lineNumber: number,
  side: SelectionSide | undefined,
): LineHashPoint | null {
  if (!Number.isSafeInteger(lineNumber) || lineNumber < 1 || isNullish(side)) {
    return null
  }

  return {lineNumber, side}
}

function formatLineHashPoint(point: LineHashPoint): string {
  return `${point.side === 'deletions' ? 'D' : 'A'}${point.lineNumber}`
}

function encodeHashValue(value: string): string {
  return encodeURIComponent(value).replaceAll('%2F', '/').replaceAll('%3F', '?')
}

function areLineHashPointsEqual(left: LineHashPoint, right: LineHashPoint): boolean {
  return left.lineNumber === right.lineNumber && left.side === right.side
}

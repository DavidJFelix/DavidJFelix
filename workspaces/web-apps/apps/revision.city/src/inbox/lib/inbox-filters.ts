// zod/mini, not zod: the search schema of a route loads on every page with the route tree. With
// zod/mini this schema adds about 6 KB gzip, with zod about 25 KB.
import {z} from 'zod/mini'

import {INBOX_REASONS, type InboxItem, type InboxReason} from './inbox-item'

export interface InboxFilters {
  query: string
  // Each value is `owner/repo`.
  repositories: readonly string[]
  authors: readonly string[]
  assignees: readonly string[]
  reasons: readonly InboxReason[]
  hideDrafts: boolean
}

export const EMPTY_INBOX_FILTERS: InboxFilters = {
  query: '',
  repositories: [],
  authors: [],
  assignees: [],
  reasons: [],
  hideDrafts: false,
}

export interface FilterInboxItemsParams {
  items: readonly InboxItem[]
  filters: InboxFilters
}

export function filterInboxItems({items, filters}: FilterInboxItemsParams): InboxItem[] {
  const words = queryWords(filters.query)
  const repositories = lowerCaseSet(filters.repositories)
  const authors = lowerCaseSet(filters.authors)
  const assignees = lowerCaseSet(filters.assignees)
  const reasons = lowerCaseSet(filters.reasons)
  return items.filter(
    (item) =>
      hasChosenValue(repositories, [repositoryOf(item)]) &&
      hasChosenValue(authors, authorsOf(item)) &&
      hasChosenValue(assignees, item.assignees) &&
      hasChosenValue(reasons, item.reasons) &&
      !(filters.hideDrafts && item.draft) &&
      matchesEveryWord(item, words),
  )
}

export interface InboxFilterOption<Value extends string = string> {
  value: Value
  count: number
}

export interface InboxFilterOptions {
  repositories: InboxFilterOption[]
  authors: InboxFilterOption[]
  assignees: InboxFilterOption[]
  reasons: InboxFilterOption<InboxReason>[]
}

// Each option counts a pull request once, under the first spelling of the value in `items`.
export function listInboxFilterOptions(items: readonly InboxItem[]): InboxFilterOptions {
  return {
    repositories: countValues(items.map((item) => [repositoryOf(item)])),
    authors: countValues(items.map(authorsOf)),
    assignees: countValues(items.map((item) => item.assignees)),
    reasons: INBOX_REASONS.map((reason) => ({
      value: reason,
      count: items.filter((item) => item.reasons.includes(reason)).length,
    })).filter((option) => option.count > 0),
  }
}

export function countActiveInboxFilters(filters: InboxFilters): number {
  return [
    isQuerySet(filters.query),
    filters.repositories.length > 0,
    filters.authors.length > 0,
    filters.assignees.length > 0,
    filters.reasons.length > 0,
    filters.hideDrafts,
  ].filter(Boolean).length
}

// The router reads text that looks like a number, a boolean or JSON as that value, and a key that
// occurs more than once as an array. A text key takes a number, a boolean or an array back as
// text, and reads any other value as not set.
const addressPrimitive = z.union([z.string(), z.number(), z.boolean()])
const addressValue = z.union([addressPrimitive, z.array(addressPrimitive)])
const addressText = z.catch(
  z.optional(
    z.pipe(
      addressValue,
      z.transform((value: z.output<typeof addressValue>) => [value].flat().join(' ')),
    ),
  ),
  undefined,
)

export const inboxSearchSchema = z.object({
  q: addressText,
  repo: addressText,
  author: addressText,
  assignee: addressText,
  reason: addressText,
  drafts: z.catch(z.optional(z.literal('hide')), undefined),
})

export type InboxSearch = z.output<typeof inboxSearchSchema>

export function readInboxFilters(search: InboxSearch): InboxFilters {
  return {
    query: search.q ?? '',
    repositories: readAddressList(search.repo),
    authors: readAddressList(search.author),
    assignees: readAddressList(search.assignee),
    reasons: readAddressList(search.reason).filter(isInboxReason),
    hideDrafts: search.drafts === 'hide',
  }
}

// The query goes into the address as typed, so that a space at its end stays while the visitor
// types the next word.
export function writeInboxSearch(filters: InboxFilters): InboxSearch {
  return {
    ...(isQuerySet(filters.query) && {q: filters.query}),
    ...(filters.repositories.length > 0 && {repo: writeAddressList(filters.repositories)}),
    ...(filters.authors.length > 0 && {author: writeAddressList(filters.authors)}),
    ...(filters.assignees.length > 0 && {assignee: writeAddressList(filters.assignees)}),
    ...(filters.reasons.length > 0 && {reason: writeAddressList(filters.reasons)}),
    ...(filters.hideDrafts && {drafts: 'hide' as const}),
  }
}

// A list goes into one key with a space between its values, because the router writes an array
// as long JSON text. Logins, repository names and reasons contain no spaces or commas, so the reader
// also splits a list at the commas that a person types.
const ADDRESS_LIST_SEPARATOR = /[\s,]+/u

function writeAddressList(values: readonly string[]): string {
  return values.join(' ')
}

function readAddressList(text: string | undefined): string[] {
  return uniqueIgnoringCase((text ?? '').split(ADDRESS_LIST_SEPARATOR).filter(Boolean))
}

function isInboxReason(value: string): value is InboxReason {
  return INBOX_REASONS.some((reason) => reason === value)
}

function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/u).filter(Boolean)
}

function isQuerySet(query: string): boolean {
  return queryWords(query).length > 0
}

function matchesEveryWord(item: InboxItem, words: readonly string[]): boolean {
  const fields = [item.title, repositoryOf(item), `#${item.number}`, ...authorsOf(item)].map(
    (field) => field.toLowerCase(),
  )
  return words.every((word) => fields.some((field) => field.includes(word)))
}

function hasChosenValue(chosen: ReadonlySet<string>, values: readonly string[]): boolean {
  return chosen.size === 0 || values.some((value) => chosen.has(value.toLowerCase()))
}

function repositoryOf(item: InboxItem): string {
  return `${item.owner}/${item.repo}`
}

function authorsOf(item: InboxItem): string[] {
  return item.author === undefined ? [] : [item.author]
}

function lowerCaseSet(values: readonly string[]): ReadonlySet<string> {
  return new Set(values.map((value) => value.toLowerCase()))
}

function uniqueIgnoringCase(values: readonly string[]): string[] {
  const keys = values.map((value) => value.toLowerCase())
  return values.filter((value, index) => keys.indexOf(value.toLowerCase()) === index)
}

function countValues(valuesPerItem: ReadonlyArray<readonly string[]>): InboxFilterOption[] {
  const options = new Map<string, InboxFilterOption>()
  for (const value of valuesPerItem.flatMap((values) => uniqueIgnoringCase(values))) {
    const key = value.toLowerCase()
    const counted = options.get(key)
    options.set(key, {value: counted?.value ?? value, count: (counted?.count ?? 0) + 1})
  }
  return [...options.values()].toSorted(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value, 'en'),
  )
}

import {INBOX_REASONS, type InboxItem, type InboxReason} from './inbox-item'

export interface InboxFilters {
  query: string
  repositoryFullNames: readonly string[]
  authorLogins: readonly string[]
  assigneeLogins: readonly string[]
  reasons: readonly InboxReason[]
  areDraftsHidden: boolean
}

export const EMPTY_INBOX_FILTERS: InboxFilters = {
  query: '',
  repositoryFullNames: [],
  authorLogins: [],
  assigneeLogins: [],
  reasons: [],
  areDraftsHidden: false,
}

export interface FilterInboxItemsParams {
  items: readonly InboxItem[]
  filters: InboxFilters
}

export function filterInboxItems({items, filters}: FilterInboxItemsParams): InboxItem[] {
  const words = queryWords(filters.query)
  const repositoryFullNames = lowerCaseSet(filters.repositoryFullNames)
  const authorLogins = lowerCaseSet(filters.authorLogins)
  const assigneeLogins = lowerCaseSet(filters.assigneeLogins)
  const reasons = lowerCaseSet(filters.reasons)
  return items.filter(
    (item) =>
      hasChosenValue(repositoryFullNames, [repositoryFullNameOf(item)]) &&
      hasChosenValue(authorLogins, authorLoginsOf(item)) &&
      hasChosenValue(assigneeLogins, item.assigneeLogins) &&
      hasChosenValue(reasons, item.reasons) &&
      !(filters.areDraftsHidden && item.draft) &&
      matchesEveryWord(item, words),
  )
}

export interface InboxFilterOption<Value extends string = string> {
  value: Value
  count: number
}

export interface InboxFilterOptions {
  repositoryFullNames: InboxFilterOption[]
  authorLogins: InboxFilterOption[]
  assigneeLogins: InboxFilterOption[]
  reasons: InboxFilterOption<InboxReason>[]
}

// Each option counts a pull request once, under the first spelling of the value in `items`.
export function listInboxFilterOptions(items: readonly InboxItem[]): InboxFilterOptions {
  return {
    repositoryFullNames: countValues(items.map((item) => [repositoryFullNameOf(item)])),
    authorLogins: countValues(items.map(authorLoginsOf)),
    assigneeLogins: countValues(items.map((item) => item.assigneeLogins)),
    reasons: INBOX_REASONS.map((reason) => ({
      value: reason,
      count: items.filter((item) => item.reasons.includes(reason)).length,
    })).filter((option) => option.count > 0),
  }
}

export function countActiveInboxFilters(filters: InboxFilters): number {
  return [
    isQuerySet(filters.query),
    filters.repositoryFullNames.length > 0,
    filters.authorLogins.length > 0,
    filters.assigneeLogins.length > 0,
    filters.reasons.length > 0,
    filters.areDraftsHidden,
  ].filter(Boolean).length
}

function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/u).filter(Boolean)
}

function isQuerySet(query: string): boolean {
  return queryWords(query).length > 0
}

function matchesEveryWord(item: InboxItem, words: readonly string[]): boolean {
  const fields = [
    item.title,
    repositoryFullNameOf(item),
    `#${item.number}`,
    ...authorLoginsOf(item),
  ].map((field) => field.toLowerCase())
  return words.every((word) => fields.some((field) => field.includes(word)))
}

function hasChosenValue(chosen: ReadonlySet<string>, values: readonly string[]): boolean {
  return chosen.size === 0 || values.some((value) => chosen.has(value.toLowerCase()))
}

function repositoryFullNameOf(item: InboxItem): string {
  return `${item.owner}/${item.repo}`
}

function authorLoginsOf(item: InboxItem): string[] {
  return item.authorLogin === undefined ? [] : [item.authorLogin]
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

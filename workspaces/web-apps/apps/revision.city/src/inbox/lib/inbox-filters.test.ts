import {defaultParseSearch, defaultStringifySearch} from '@tanstack/react-router'
import {
  assert,
  boolean,
  constant,
  dictionary,
  jsonValue,
  oneof,
  property,
  record,
  shuffledSubarray,
  string,
  stringMatching,
  tuple,
  uniqueArray,
} from 'fast-check'
import {expect, test} from 'vitest'

import {
  countActiveInboxFilters,
  EMPTY_INBOX_FILTERS,
  filterInboxItems,
  type InboxFilters,
  inboxSearchSchema,
  listInboxFilterOptions,
  readInboxFilters,
  writeInboxSearch,
} from './inbox-filters'
import {INBOX_REASONS, type InboxItem} from './inbox-item'

function inboxItem(fields: Partial<InboxItem> & Pick<InboxItem, 'number'>): InboxItem {
  return {
    owner: 'acme',
    repo: 'app',
    title: `Pull request ${fields.number}`,
    draft: false,
    assigneeLogins: [],
    reasons: ['watched'],
    ...fields,
  }
}

function filters(fields: Partial<InboxFilters>): InboxFilters {
  return {...EMPTY_INBOX_FILTERS, ...fields}
}

const ITEMS = [
  inboxItem({
    number: 1,
    title: 'Fix the login redirect',
    authorLogin: 'Alice',
    assigneeLogins: ['bob'],
    reasons: ['review-requested'],
  }),
  inboxItem({
    number: 2,
    repo: 'web',
    title: 'Add a dark mode',
    authorLogin: 'bob',
    draft: true,
    reasons: ['assigned', 'owned'],
  }),
  inboxItem({
    number: 12,
    owner: 'labs',
    repo: 'api',
    title: 'Bump zod',
    authorLogin: 'renovate[bot]',
    assigneeLogins: ['Alice', 'carol'],
    reasons: ['member'],
  }),
  inboxItem({number: 30, title: 'Move the sessions table', draft: true}),
]

function filteredNumbers(fields: Partial<InboxFilters>): number[] {
  return filterInboxItems({items: ITEMS, filters: filters(fields)}).map((item) => item.number)
}

test('no filter keeps every item in its order', () => {
  expect(filteredNumbers({})).toEqual([1, 2, 12, 30])
})

interface FilterRow {
  name: string
  fields: Partial<InboxFilters>
  expected: number[]
}

test.each<FilterRow>([
  {name: 'a query word in the title', fields: {query: 'login'}, expected: [1]},
  {name: 'a query word in another letter case', fields: {query: 'LOGIN'}, expected: [1]},
  {name: 'a query of a pull request number', fields: {query: '#12'}, expected: [12]},
  {name: 'a query of owner/repo', fields: {query: 'Acme/App'}, expected: [1, 30]},
  {name: 'a query of an author login', fields: {query: 'renovate'}, expected: [12]},
  {name: 'query words found in different fields', fields: {query: 'alice login'}, expected: [1]},
  {name: 'query words where one is not found', fields: {query: 'alice dark'}, expected: []},
  {name: 'a query of only spaces', fields: {query: '   '}, expected: [1, 2, 12, 30]},
  {name: 'a query on an item with no author', fields: {query: 'sessions'}, expected: [30]},
  {name: 'one repository', fields: {repositoryFullNames: ['acme/app']}, expected: [1, 30]},
  {
    name: 'two repositories',
    fields: {repositoryFullNames: ['acme/app', 'labs/api']},
    expected: [1, 12, 30],
  },
  {
    name: 'a repository in another letter case',
    fields: {repositoryFullNames: ['ACME/App']},
    expected: [1, 30],
  },
  {name: 'one author', fields: {authorLogins: ['bob']}, expected: [2]},
  {name: 'two authors', fields: {authorLogins: ['bob', 'renovate[bot]']}, expected: [2, 12]},
  {name: 'an author in another letter case', fields: {authorLogins: ['alice']}, expected: [1]},
  {name: 'one assignee', fields: {assigneeLogins: ['carol']}, expected: [12]},
  {name: 'two assignees', fields: {assigneeLogins: ['bob', 'carol']}, expected: [1, 12]},
  {name: 'an assignee in another letter case', fields: {assigneeLogins: ['ALICE']}, expected: [12]},
  {name: 'one reason', fields: {reasons: ['owned']}, expected: [2]},
  {name: 'two reasons', fields: {reasons: ['review-requested', 'watched']}, expected: [1, 30]},
  {name: 'drafts hidden', fields: {areDraftsHidden: true}, expected: [1, 12]},
  {name: 'a value that no item has', fields: {authorLogins: ['nobody']}, expected: []},
  {
    name: 'a repository and hidden drafts',
    fields: {repositoryFullNames: ['acme/app'], areDraftsHidden: true},
    expected: [1],
  },
  {
    name: 'two repositories and an author',
    fields: {repositoryFullNames: ['acme/app', 'acme/web'], authorLogins: ['bob']},
    expected: [2],
  },
  {name: 'a query and a reason', fields: {query: 'acme', reasons: ['assigned']}, expected: [2]},
  {
    name: 'every filter',
    fields: {
      query: 'bump',
      repositoryFullNames: ['labs/api'],
      authorLogins: ['renovate[bot]'],
      assigneeLogins: ['carol'],
      reasons: ['member'],
      areDraftsHidden: true,
    },
    expected: [12],
  },
])('filters by $name', ({fields, expected}) => {
  expect(filteredNumbers(fields)).toEqual(expected)
})

test.each([
  {name: 'an author', fields: {authorLogins: ['alice']}},
  {name: 'an assignee', fields: {assigneeLogins: ['alice']}},
])('a filter by $name drops an item with no author and no assignees', ({fields}) => {
  const item = inboxItem({number: 30})

  expect(filterInboxItems({items: [item], filters: filters(fields)})).toEqual([])
})

test('the options count the pull requests for each value and sort by that number, then by name', () => {
  const items = [
    inboxItem({number: 1, repo: 'web', authorLogin: 'bob', assigneeLogins: ['Carol', 'carol']}),
    inboxItem({
      number: 2,
      authorLogin: 'Bob',
      assigneeLogins: ['dave'],
      reasons: ['owned', 'watched'],
    }),
    inboxItem({number: 3, reasons: ['review-requested', 'watched']}),
    inboxItem({
      number: 4,
      owner: 'Labs',
      repo: 'API',
      authorLogin: 'alice',
      assigneeLogins: ['carol'],
      reasons: ['owned'],
    }),
    inboxItem({number: 5, owner: 'labs', repo: 'api', authorLogin: 'alice'}),
  ]

  expect(listInboxFilterOptions(items)).toEqual({
    repositoryFullNames: [
      {value: 'acme/app', count: 2},
      {value: 'Labs/API', count: 2},
      {value: 'acme/web', count: 1},
    ],
    authorLogins: [
      {value: 'alice', count: 2},
      {value: 'bob', count: 2},
    ],
    assigneeLogins: [
      {value: 'Carol', count: 2},
      {value: 'dave', count: 1},
    ],
    reasons: [
      {value: 'review-requested', count: 1},
      {value: 'owned', count: 2},
      {value: 'watched', count: 4},
    ],
  })
})

test('an empty inbox has no options', () => {
  expect(listInboxFilterOptions([])).toEqual({
    repositoryFullNames: [],
    authorLogins: [],
    assigneeLogins: [],
    reasons: [],
  })
})

interface CountRow {
  name: string
  fields: Partial<InboxFilters>
  expected: number
}

test.each<CountRow>([
  {name: 'no filter', fields: {}, expected: 0},
  {name: 'a query of only spaces', fields: {query: '  '}, expected: 0},
  {name: 'a query', fields: {query: 'login'}, expected: 1},
  {name: 'repositories', fields: {repositoryFullNames: ['acme/app', 'acme/web']}, expected: 1},
  {name: 'an author', fields: {authorLogins: ['alice']}, expected: 1},
  {name: 'an assignee', fields: {assigneeLogins: ['bob']}, expected: 1},
  {name: 'a reason', fields: {reasons: ['owned']}, expected: 1},
  {name: 'hidden drafts', fields: {areDraftsHidden: true}, expected: 1},
  {
    name: 'every filter',
    fields: {
      query: 'login',
      repositoryFullNames: ['acme/app'],
      authorLogins: ['alice'],
      assigneeLogins: ['bob'],
      reasons: ['owned'],
      areDraftsHidden: true,
    },
    expected: 6,
  },
])('$name counts as $expected active filters', ({fields, expected}) => {
  expect(countActiveInboxFilters(filters(fields))).toBe(expected)
})

// These helpers use the parse, validation and stringify of the router, as the app runs them with
// no custom serializer.
function readAddress(address: string): InboxFilters {
  const result = inboxSearchSchema['~standard'].validate(defaultParseSearch(address))
  if (result instanceof Promise || result.issues !== undefined) {
    throw new Error(`The router shows an error page for ${address}.`)
  }
  return readInboxFilters(result.value)
}

const ENCODED_SLASH = encodeURIComponent('/')

function writeAddress(fields: InboxFilters): string {
  return defaultStringifySearch(writeInboxSearch(fields))
}

interface AddressRow {
  name: string
  fields: Partial<InboxFilters>
  address: string
}

test.each<AddressRow>([
  {name: 'no filter', fields: {}, address: ''},
  {name: 'a query', fields: {query: 'fix login'}, address: '?q=fix+login'},
  {name: 'a query that ends in a space', fields: {query: 'fix '}, address: '?q=fix+'},
  {
    name: 'two repositories',
    fields: {repositoryFullNames: ['acme/app', 'acme/web']},
    address: `?repo=acme${ENCODED_SLASH}app+acme${ENCODED_SLASH}web`,
  },
  {
    name: 'two authors',
    fields: {authorLogins: ['alice', 'bob']},
    address: '?author=alice+bob',
  },
  {name: 'a login of only digits', fields: {authorLogins: ['1234']}, address: '?author=%221234%22'},
  {name: 'an assignee', fields: {assigneeLogins: ['bob']}, address: '?assignee=bob'},
  {
    name: 'two reasons',
    fields: {reasons: ['review-requested', 'assigned']},
    address: '?reason=review-requested+assigned',
  },
  {name: 'hidden drafts', fields: {areDraftsHidden: true}, address: '?drafts=hide'},
  {
    name: 'every filter',
    fields: {
      query: 'login',
      repositoryFullNames: ['acme/app'],
      authorLogins: ['alice'],
      assigneeLogins: ['bob'],
      reasons: ['owned'],
      areDraftsHidden: true,
    },
    address: `?q=login&repo=acme${ENCODED_SLASH}app&author=alice&assignee=bob&reason=owned&drafts=hide`,
  },
])('the address of $name goes there and back', ({fields, address}) => {
  expect(writeAddress(filters(fields))).toBe(address)
  expect(readAddress(address)).toEqual(filters(fields))
})

test('a query of only spaces leaves no key in the address', () => {
  expect(writeInboxSearch(filters({query: '   '}))).toStrictEqual({})
})

interface OddAddressRow {
  name: string
  address: string
  expected: Partial<InboxFilters>
}

test.each<OddAddressRow>([
  {name: 'unknown keys', address: '?page=2&sort=new', expected: {}},
  {name: 'empty values', address: '?q=&repo=&drafts=', expected: {}},
  {name: 'a query of null', address: '?q=null', expected: {}},
  {name: 'a repository as a JSON object', address: '?repo={"owner":"acme"}', expected: {}},
  {name: 'a query as a list of JSON objects', address: '?q=[{"a":1}]', expected: {}},
  {name: 'drafts that are not hide', address: '?drafts=true', expected: {}},
  {name: 'an unknown reason', address: '?reason=mentioned', expected: {}},
  {
    name: 'an unknown reason beside a known one',
    address: '?reason=mentioned+owned',
    expected: {reasons: ['owned']},
  },
  {name: 'a repeated reason', address: '?reason=owned+owned', expected: {reasons: ['owned']}},
  {
    name: 'a repeated key with values in two letter cases',
    address: '?author=alice&author=Alice&author=bob',
    expected: {authorLogins: ['alice', 'bob']},
  },
  {
    name: 'a list with commas',
    address: '?repo=acme/app,%20acme/web',
    expected: {repositoryFullNames: ['acme/app', 'acme/web']},
  },
  {name: 'a query that the router reads as a number', address: '?q=12', expected: {query: '12'}},
  {
    name: 'a query that the router reads as a boolean',
    address: '?q=true',
    expected: {query: 'true'},
  },
  {
    name: 'a login that the router reads as a number',
    address: '?assignee=1234',
    expected: {assigneeLogins: ['1234']},
  },
])('the address with $name reads without an error', ({address, expected}) => {
  expect(readAddress(address)).toEqual(filters(expected))
})

const loginArbitrary = stringMatching(/^[A-Za-z\d][A-Za-z\d-]{0,8}(?:\[bot\])?$/)
const repositoryArbitrary = tuple(
  stringMatching(/^[A-Za-z\d][A-Za-z\d-]{0,8}$/),
  stringMatching(/^[\w.-]{1,10}$/),
).map(([owner, repo]) => `${owner}/${repo}`)
const lowerCase = (value: string) => value.toLowerCase()

test('any filters go into the address and back unchanged', () => {
  const filtersArbitrary = record({
    query: oneof(
      constant(''),
      string({unit: 'grapheme', minLength: 1}).filter((query) => /\S/u.test(query)),
    ),
    repositoryFullNames: uniqueArray(repositoryArbitrary, {selector: lowerCase, maxLength: 4}),
    authorLogins: uniqueArray(loginArbitrary, {selector: lowerCase, maxLength: 4}),
    assigneeLogins: uniqueArray(loginArbitrary, {selector: lowerCase, maxLength: 4}),
    reasons: shuffledSubarray([...INBOX_REASONS]),
    areDraftsHidden: boolean(),
  })

  assert(
    property(filtersArbitrary, (fields) => {
      expect(readAddress(writeAddress(fields))).toEqual(fields)
    }),
  )
})

test('any values in the address pass the schema with no issue', () => {
  assert(
    property(dictionary(string(), jsonValue()), (search) => {
      expect(inboxSearchSchema['~standard'].validate(search)).not.toHaveProperty('issues')
    }),
  )
})

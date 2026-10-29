import {expect, test} from 'vitest'
import type {Finding} from './findings'
import {
  fingerprintFinding,
  formatCheckRunOutput,
  formatFindingComment,
  formatReviewBody,
  neutralizeMarkdown,
  readFingerprint,
} from './review-markdown'
import type {PullRequestReview} from './review-pull-request'

const ZERO_WIDTH_SPACE = '\u200B'

const finding: Finding = {
  reviewerId: 'security',
  path: 'src/a.ts',
  severity: 'high',
  title: 'Token leaks',
  body: 'The token reaches the log.',
  checked: true,
  startLine: 4,
  endLine: 4,
}

test.each([
  {text: 'ask @someone', expected: `ask @${ZERO_WIDTH_SPACE}someone`},
  {text: 'ping @org/team', expected: `ping @${ZERO_WIDTH_SPACE}org/team`},
  {
    text: 'see #12 and owner/repo#3',
    expected: `see #${ZERO_WIDTH_SPACE}12 and owner/repo#${ZERO_WIDTH_SPACE}3`,
  },
  {text: 'see GH-12', expected: `see GH-${ZERO_WIDTH_SPACE}12`},
  {
    text: '<img src=x> </b> <!-- x -->',
    expected: `<${ZERO_WIDTH_SPACE}img src=x> <${ZERO_WIDTH_SPACE}/b> <${ZERO_WIDTH_SPACE}!-- x -->`,
  },
  {text: 'in `@Override` code', expected: `in \`@${ZERO_WIDTH_SPACE}Override\` code`},
  {
    text: 'see gh-12, GH\\-12, &#64;someone, and &commat;x',
    expected: `see gh-${ZERO_WIDTH_SPACE}12, GH\\-${ZERO_WIDTH_SPACE}12, &${ZERO_WIDTH_SPACE}#${ZERO_WIDTH_SPACE}64;someone, and &${ZERO_WIDTH_SPACE}commat;x`,
  },
  {
    text: 'see https://github.com/o/r/issues/1 and [x](//www.GitHub\\.com\\/o/r/pull/2)',
    expected:
      'see https://redirect.github.com/o/r/issues/1 and [x](//redirect.github.com\\/o/r/pull/2)',
  },
  {
    text: 'api.github.com/repos, my_github.com/o, my-github.com/o, github.com',
    expected: 'api.github.com/repos, my_github.com/o, my-github.com/o, github.com',
  },
  {text: '_www.github.com/o/r/issues/1', expected: '_redirect.github.com/o/r/issues/1'},
  {
    text: 'Fix:\n\n```suggestion\nevil()\n```\n\n> ~~~ Suggestion',
    expected: `Fix:\n\n\`\`\`${ZERO_WIDTH_SPACE}suggestion\nevil()\n\`\`\`\n\n> ~~~ ${ZERO_WIDTH_SPACE}Suggestion`,
  },
  {text: 'a < b & c; @ alone, # heading', expected: 'a < b & c; @ alone, # heading'},
])(
  'neutralizeMarkdown stops mentions, references, suggestions, and HTML in $text',
  ({text, expected}) => {
    expect(neutralizeMarkdown(text)).toBe(expected)
    expect(neutralizeMarkdown(expected)).toBe(expected)
  },
)

test('formatFindingComment starts with the fingerprint and puts the text after it', () => {
  const comment = formatFindingComment(
    {...finding, title: 'Leak\r\nfor\r@someone', body: 'Ask @someone.'},
    '0123456789abcdef',
  )

  expect(comment).toBe(
    [
      '<!-- revision-city:0123456789abcdef -->',
      `**high** (security): Leak for @${ZERO_WIDTH_SPACE}someone`,
      `Ask @${ZERO_WIDTH_SPACE}someone.`,
    ].join('\n\n'),
  )
  expect(readFingerprint(comment)).toBe('0123456789abcdef')
})

test('formatFindingComment fences a suggestion so that its backticks cannot close the fence', () => {
  const comment = formatFindingComment(
    {...finding, suggestion: 'const fence = "````"\n'},
    '0123456789abcdef',
  )

  expect(comment).toContain('\n\n`````suggestion\nconst fence = "````"\n`````\n\n')
})

test('formatFindingComment keeps an empty suggestion, which deletes the lines', () => {
  const comment = formatFindingComment({...finding, suggestion: ''}, '0123456789abcdef')

  expect(comment).toContain('\n\n```suggestion\n```\n\n')
})

test('formatFindingComment puts the body last, so that a fence it leaves open cannot take in the suggestion', () => {
  const comment = formatFindingComment(
    {...finding, body: '```ts\nopen', suggestion: 'fixed()'},
    '0123456789abcdef',
  )

  expect(comment).toBe(
    [
      '<!-- revision-city:0123456789abcdef -->',
      '**high** (security): Token leaks',
      '```suggestion\nfixed()\n```',
      '```ts\nopen',
    ].join('\n\n'),
  )
})

test('readFingerprint ignores a marker that is not at the start of the comment', () => {
  expect(readFingerprint('text\n<!-- revision-city:0123456789abcdef -->')).toBeUndefined()
  expect(readFingerprint('<!-- revision-city:not-hex -->')).toBeUndefined()
})

test('fingerprintFinding ignores the lines and changes with the text', async () => {
  const fingerprint = await fingerprintFinding(finding)

  expect(fingerprint).toMatch(/^[0-9a-f]{16}$/)
  expect(await fingerprintFinding({...finding, startLine: 9, endLine: 10})).toBe(fingerprint)
  expect(await fingerprintFinding({...finding, body: 'Other'})).not.toBe(fingerprint)
})

test('formatReviewBody points at the check when the findings are inline comments', () => {
  expect(formatReviewBody({findings: [finding, finding], inlineAccepted: true})).toBe(
    'Revision City posted 2 new findings. The Revision City check lists every finding.',
  )
})

test('formatReviewBody lists the findings when GitHub refused them as inline comments', () => {
  const body = formatReviewBody({
    findings: [{...finding, title: 'Ask @someone', startLine: 2, endLine: 5}],
    inlineAccepted: false,
  })

  expect(body).toBe(
    [
      'Revision City posted 1 new finding. GitHub did not accept inline comments on these lines:',
      '',
      `- **high** \`src/a.ts:2-5\` (security): Ask @${ZERO_WIDTH_SPACE}someone`,
    ].join('\n'),
  )
})

const review: PullRequestReview = {
  findings: [],
  failures: [],
  chunkReviewCount: 3,
  cachedCount: 1,
  usage: {promptTokens: 10, completionTokens: 5, costUsd: 0.0123},
  costs: [],
}

test('formatCheckRunOutput reports a clean review without a list', () => {
  expect(
    formatCheckRunOutput({
      outcome: {reported: [], unchecked: [], failed: false},
      review,
      notReviewed: [],
      postedCount: 0,
    }),
  ).toEqual({
    title: 'No findings',
    summary:
      '3 chunk reviews, 1 from saved results, cost $0.0123. 0 new findings posted. ' +
      'This check fails on a checked finding at high or above, or on a failed chunk review.',
  })
})

test('formatCheckRunOutput lists findings, failures, and files that were not reviewed', () => {
  const output = formatCheckRunOutput({
    outcome: {reported: [finding], unchecked: [], failed: true},
    review: {
      ...review,
      chunkReviewCount: 1,
      failures: [{path: 'src/b.ts', reviewerId: 'comments', error: 'Error: bad\nanswer'}],
    },
    notReviewed: [{path: 'src/@someone\r\n.json', reason: 'GitHub shows no text diff'}],
    postedCount: 1,
  })

  expect(output.title).toBe('1 finding, 1 failed chunk review')
  expect(output.summary).toContain('1 chunk review, 1 from saved results')
  expect(output.summary).toContain('1 new finding posted.')
  expect(output.text).toBe(
    [
      '### Findings',
      '',
      '- **high** `src/a.ts:4` (security): Token leaks',
      '',
      '### Failed chunk reviews',
      '',
      '- `src/b.ts` (comments): `Error: bad answer`',
      '',
      '### Not reviewed',
      '',
      `- \`src/@${ZERO_WIDTH_SPACE}someone .json\`: GitHub shows no text diff`,
    ].join('\n'),
  )
})

test('formatCheckRunOutput lists unchecked findings last and counts them in the title', () => {
  const output = formatCheckRunOutput({
    outcome: {reported: [], unchecked: [{...finding, checked: false}], failed: false},
    review,
    notReviewed: [{path: 'image.png', reason: 'GitHub shows no text diff'}],
    postedCount: 0,
  })

  expect(output.title).toBe('1 unchecked finding')
  expect(output.text).toBe(
    [
      '### Not reviewed',
      '',
      '- `image.png`: GitHub shows no text diff',
      '',
      '### Not checked, so not posted',
      '',
      '- **high** `src/a.ts:4` (security): Token leaks',
    ].join('\n'),
  )
})

test('formatCheckRunOutput keeps each path with backticks inside its code span', () => {
  const output = formatCheckRunOutput({
    outcome: {
      reported: [{...finding, path: 'a`[x](https://example.com)`.ts'}],
      unchecked: [],
      failed: true,
    },
    review: {...review, failures: [{path: '``b', reviewerId: 'comments', error: 'Error'}]},
    notReviewed: [{path: 'c `', reason: 'GitHub shows no text diff'}],
    postedCount: 0,
  })

  expect(output.text).toContain('- **high** ``a`[x](https://example.com)`.ts:4`` (security)')
  expect(output.text).toContain('- ``` ``b ``` (comments)')
  expect(output.text).toContain('- `` c ` ``: GitHub shows no text diff')
})

test('formatCheckRunOutput cuts a list longer than a check run can show', () => {
  const output = formatCheckRunOutput({
    outcome: {reported: [], unchecked: [], failed: false},
    review,
    notReviewed: Array.from({length: 3000}, (_, index) => ({
      path: `generated/file-${index}.json`,
      reason: 'GitHub shows no text diff',
    })),
    postedCount: 0,
  })

  expect(output.text?.length).toBeLessThanOrEqual(65_000)
  expect(output.text?.endsWith('\n\n(Cut: the list is longer than a check run can show.)')).toBe(
    true,
  )
})

test('formatCheckRunOutput lists the cost of each chunk review last, most expensive first', () => {
  const output = formatCheckRunOutput({
    outcome: {reported: [], unchecked: [], failed: false},
    review: {
      ...review,
      costs: [
        {
          path: 'src/a.ts',
          reviewerId: 'security',
          cached: true,
          usage: {promptTokens: 0, completionTokens: 0, costUsd: 0},
        },
        {
          path: 'src/b.ts',
          part: 2,
          reviewerId: 'comments',
          cached: false,
          usage: {promptTokens: 1200, completionTokens: 300, costUsd: 0.0081},
        },
        {
          path: 'src/@c.ts',
          reviewerId: 'security',
          cached: false,
          usage: {promptTokens: 4000, completionTokens: 90, costUsd: 0.0042},
        },
      ],
    },
    notReviewed: [{path: 'image.png', reason: 'GitHub shows no text diff'}],
    postedCount: 0,
  })

  expect(output.text).toBe(
    [
      '### Not reviewed',
      '',
      '- `image.png`: GitHub shows no text diff',
      '',
      '### Cost per chunk review',
      '',
      '- $0.0081 `src/b.ts` part 2 (comments): 1200 prompt tokens, 300 completion tokens',
      `- $0.0042 \`src/@${ZERO_WIDTH_SPACE}c.ts\` (security): 4000 prompt tokens, 90 completion tokens`,
      '- $0.0000 `src/a.ts` (security): saved result',
    ].join('\n'),
  )
})

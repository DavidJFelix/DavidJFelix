# Simplified Technical English for comments

A digest of the ASD-STE100 writing rules, adapted to source comments and documentation prose. The
specification (Issue 8, free on request from <https://www.asd-ste100.org/>) is authoritative; when
this digest and the specification disagree, the specification wins and this file gets corrected.

## Adaptations for code

- **Identifiers are exempt.** A type, function, variable, file, flag, or package name is written as
  it appears in code, in backticks, and never counts as a word for the rules below.
- **Technical names are allowed.** STE permits the technical vocabulary of the domain (its
  "technical names" and "technical verbs"). In this repo those are the glossary terms in the
  relevant `CONTEXT.md` and the established names of tools and platforms.
- **Quoted material is exempt.** Error messages, commands, URLs, and spec excerpts are reproduced,
  not rewritten.

## Sentence rules

| Rule                                               | Do                                                             | Not                                                                |
| -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| One topic per sentence                             | "The cache stores the token. It expires after one hour."       | "The cache stores the token, which expires after an hour and ..."  |
| Instruction sentences at most 20 words             | "Export both variables before you run the script."             | A 30-word sentence with two conditions and a caveat                |
| Description sentences at most 25 words             |                                                                |                                                                    |
| Paragraphs at most six sentences, topic first      | Lead with the decision; evidence follows                       | Build up to the point                                              |
| Active voice                                       | "The worker deletes stale entries."                            | "Stale entries are deleted."                                       |
| Present tense for descriptions                     | "The parser returns `null` on an empty input."                 | "The parser will return `null`..."                                 |
| Imperative for instructions                        | "Run `mise install`."                                          | "You should run `mise install`." / "`mise install` needs running." |
| No gerund as a verb                                | "Sort the rows before you deduplicate them."                   | "Sorting the rows before deduplicating."                           |
| Keep articles and connecting words                 | "Removes the entry when it is stale."                          | "Removes entry when stale."                                        |
| At most three nouns in a cluster                   | "the deploy token for the preview worker"                      | "the preview worker deploy token"                                  |
| One instruction per sentence                       | "Stop the server. Then delete the cache."                      | "Stop the server and delete the cache."                            |
| Conditions first                                   | "If the list is empty, the loop does not run."                 | "The loop does not run if the list is empty."                      |
| No idioms, slang, or humour that needs translating | "This is slow."                                                | "This is a real dog." / "Here be dragons."                         |
| Warnings before the step they protect              | "Do not call this twice: it re-sends the email. Call it once." | "Call it once (calling it twice re-sends the email)."              |

## Word rules

One word, one meaning. Prefer the plain word, and use each word in only one part of speech. The
substitutions below are the ones that appear most in comments; the specification's dictionary has
the complete list.

| Not approved                            | Use                        |
| --------------------------------------- | -------------------------- |
| utilize, leverage, employ (a thing)     | use                        |
| perform, execute, carry out (an action) | do, run                    |
| initiate, commence, kick off            | start                      |
| terminate, cease                        | stop, end                  |
| prior to, in advance of                 | before                     |
| subsequent to, following (a step)       | after                      |
| in order to, so as to                   | to                         |
| in the event that, in case of, should   | if                         |
| ensure, verify (that)                   | make sure                  |
| sufficient, adequate                    | enough                     |
| require(s)                              | must, need                 |
| attempt                                 | try                        |
| obtain, acquire, retrieve               | get                        |
| indicate, denote, signify               | show, mean                 |
| assist                                  | help                       |
| modify, alter                           | change                     |
| remain                                  | stay                       |
| additional, supplementary               | more, other                |
| currently, presently                    | now                        |
| however, nevertheless (mid-sentence)    | but (start a new sentence) |
| due to the fact that                    | because                    |
| a number of, numerous                   | many, some, or the number  |
| appropriate, suitable                   | correct, applicable        |
| basically, essentially, simply          | (delete)                   |
| note that, it should be noted           | (delete; state the fact)   |

Words with more than one common meaning are used in one meaning only. In this repo: `check` is a
verb for tests and gates (a CI check, `check` a condition), `run` is a verb, `key` is a map key or a
credential but never both in one file.

## Applying the rules to a comment

Rewrite, do not pad. The STE rules shorten prose; a rewrite that grows the comment has gone wrong.

Before:

```ts
// Note that we need to make sure the token is refreshed prior to it being
// utilized by the downstream fetch, otherwise the request will basically fail.
```

After:

```ts
// Refresh the token before the fetch uses it. An expired token fails the request.
```

Before, on a shared-package export:

```ts
/** This function is used for parsing the preview URL out of the stdout. */
```

After:

```ts
/**
 * Extracts the preview URL from the deploy command's stdout.
 *
 * Returns `null` when the output has no `https://` line; callers treat that as a failed deploy.
 */
```

import {
  type FileDiffMetadata,
  getFiletypeFromFileName,
  resolveLanguages,
  type SupportedLanguages,
} from '@pierre/diffs'

// The library draws these languages without a grammar.
const LANGUAGES_WITHOUT_GRAMMAR: ReadonlySet<SupportedLanguages> = new Set(['text', 'ansi'])

export interface GrammarPreloaderOptions {
  resolve?: (languages: SupportedLanguages[]) => Promise<unknown>
}

// Starts the grammar fetch for a language when the viewer parses the first file in that language.
// The library keeps each resolved grammar on the main thread. It sends the grammar to a worker with
// the first task in that language, so the task does not wait for a fetch.
export function createGrammarPreloader({resolve = resolveLanguages}: GrammarPreloaderOptions = {}) {
  const requestedLanguages = new Set<SupportedLanguages>()
  return (fileDiff: FileDiffMetadata) => {
    const language = fileDiff.lang ?? getFiletypeFromFileName(fileDiff.name)
    if (LANGUAGES_WITHOUT_GRAMMAR.has(language) || requestedLanguages.has(language)) {
      return
    }
    requestedLanguages.add(language)
    // A failed preload changes nothing: the highlight task loads the grammar again and reports
    // its own failure.
    resolve([language]).catch(() => undefined)
  }
}

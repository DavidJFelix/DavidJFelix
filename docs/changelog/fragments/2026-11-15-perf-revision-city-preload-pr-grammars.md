### perf(revision.city): preload the grammars of the languages in a PR

The diffs viewer now starts the grammar fetch for a language when it parses the first file in that
language. Before, a file outside the fixed preload list (`rust`, `tsx`, `typescript`) showed as
plain text until its highlight task got the grammar. A local Chromium check used a six-file Go diff
and added a 150 ms delay to the grammar fetch. The fetch started about 260 ms earlier, and the first
colored tokens showed about 185 ms earlier (median of seven loads, 731 ms to 546 ms).

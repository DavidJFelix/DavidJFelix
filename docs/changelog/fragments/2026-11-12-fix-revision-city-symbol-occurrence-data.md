### fix(revision.city): keep the symbol occurrence number as data

Each symbol now carries its path and its occurrence number as separate fields, and the Symbols
matcher groups repeated names by that path. Before, the matcher removed every `#<n>` from the name
with a pattern, so a number that the author wrote was also removed: a Markdown heading "Fix #12"
changed to "Fix #14" showed no row. It now shows one renamed row. The display names do not change.

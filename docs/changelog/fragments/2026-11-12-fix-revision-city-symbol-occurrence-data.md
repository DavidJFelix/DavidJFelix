### fix(revision.city): keep the symbol occurrence number as data

Each symbol now carries its path and its occurrence number as separate fields, and the Symbols
matcher groups repeated names by that path. Before, the matcher removed every `#<n>` from the name
with a pattern, so a number that the author wrote was also removed, and two headings that differ
only in that number had the same identity. A heading "Verified on Depot (PR #406)" changed to
"Verified on Depot (PR #407)" now shows one renamed row in place of a modified row. The display
names do not change.

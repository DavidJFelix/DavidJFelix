### fix(revision.city): extract markdown symbols in linear time on runs of spaces

Two parts of markdown symbol extraction were slow on a long run of spaces. The regex that removed
the closing `#` run from a heading name backtracked, so a heading with a run of 4,000 spaces took 25
s. The hard-break rule of `@lezer/markdown` read a run of spaces again from each space in it. So a
run of 40,000 spaces in a paragraph took 5 s to parse. A loop now removes the closing `#` run, and
the Symbols parser drops the hard-break rule, which no entity needs. A run of 1,000,000 spaces now
parses in 0.1 s. The entities of 13,467 markdown files from this repository and its dependencies do
not change.

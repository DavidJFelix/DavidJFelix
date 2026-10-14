### fix(revision.city): give the fuzzy rename phase a token budget

The entity diff finds a renamed and edited entity by comparing each new entity with each old one of
the same kind. Each comparison reads the tokens of both. A nested entity holds the tokens of each
entity inside it. So two 11 KB files of 200 nested namespaces made this phase read 624 million
tokens, and the entity diff took 11 s.

The phase now runs only when the comparisons of all same-kind pairs would read at most 20,000,000
tokens, which takes about 0.8 s. Otherwise the unmatched entities show as added and deleted, as they
do when a file has more than 200 of them. The same files now take 1.3 s. For a renamed 92 KB class
with 150 edited methods, the comparisons would read 7.7 million tokens, so the class still shows as
a rename. In 4,365 real diffs from this repository, the phase would read at most 153,910 tokens, and
no result changes.

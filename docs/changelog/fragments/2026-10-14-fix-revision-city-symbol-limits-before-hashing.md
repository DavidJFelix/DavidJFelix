### fix(revision.city): check symbol limits before hashing entities

Symbol extraction hashed every entity in a file before the entity diff checked its limit of 2000
entities, and `read_definition` had no limit. A hash reads all the text of its entity, so the
extractor read nested text again at each level. A 153 KB file of 200 nested namespaces took 11.8 s
and 248 MB, though it held only 200 entities. A file of many small arrays had a similar cost,
because the extractor compared each array element with each entity. The extractor now checks three
limits before it hashes: 2000 entities, 2,000,000 characters of entity text and qualified names, and
10,000 fingerprinted array elements. A file over a limit is too large. The Symbols tab shows no
changes for it, as it did before for a file over 2000 entities. `read_definition` tells the model to
use `read_file`. The nested file now takes 0.4 s and 6 MB.

### fix(revision.city): read the answer after other JSON in a model reply

A model can quote other JSON, for example from the diff, before its answer. The answer parser took
the first JSON object in the reply, so such a reply failed its chunk review. The parser now takes
the first object that has a `findings` list.

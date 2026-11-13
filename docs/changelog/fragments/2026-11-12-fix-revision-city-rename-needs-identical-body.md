### fix(revision.city): claim a shape rename only for an identical body

The Symbols tab called two entities a rename when they had the same shape, even when their text was
not related. Now the shape match also needs the same body, without the name. Other pairs go to the
token match, which marks a rename whose body also changed as "body edited". Some pairs that matched
by chance now show as one added and one deleted row.

### fix(revision.city): pair leftover same-name symbols by likeness

When a file deletes one of several same-name symbols and edits a sibling, the Symbols tab now blames
the right ones. Repeated names (overloads, workflow step keys) that are left over after the content
matches used to pair by position, so the row for the edit went to the deleted sibling. Now each
leftover on the shorter side pairs in order, and the longer side skips the entries that give the
lowest total likeness, scored on the words inside each token. Equal counts still pair in order, and
a group over the read budget keeps the old pairing.

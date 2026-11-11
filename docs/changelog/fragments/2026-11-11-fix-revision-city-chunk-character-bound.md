### fix(revision.city): skip diffs with very long lines and bound a chunk's characters

The review engine bounded a chunk by lines only, so a generated file of one long line went to each
reviewer as one huge chunk. A file with a diff line longer than 5,000 characters now shows under
"Not reviewed" with its own reason, and a chunk also stops at 40,000 characters. Normal code and
prose get the same chunks as before.

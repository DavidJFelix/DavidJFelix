### fix(revision.city): post only the findings that the reviewer marks as checked

On #823 to #826, 5 of the 9 false findings said in their own text that the reviewer did not check
them. One said "I need to verify what read_definition actually does now". The prompt already told
the reviewer to leave out a problem that it is not sure of.

Now the prompt asks the reviewer to give each finding a `checked` field. It asks for `true` only
when the chunk, or a file that the reviewer read, shows that the problem is real. The review posts
only checked findings, and an unchecked finding cannot fail the check. The check run lists the other
findings under "Not checked, so not posted" and counts them in its title. A missing or invalid
`checked` value counts as not checked.

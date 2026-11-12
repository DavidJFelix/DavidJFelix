### fix(revision.city): cite diff lines in a finding proof by their text

The finding check now reads that the numbers on the left of the diff piece are labels for the piece,
not file line numbers. A proof quotes a diff line by its text and file path, and gives a line from a
tool result its file path and its "L" number. The saved-result key version goes from 2 to 3, so the
first review of each open pull request after this change pays again for every chunk review.

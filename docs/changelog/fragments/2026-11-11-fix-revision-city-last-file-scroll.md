### fix(revision.city): scroll to the end of the last file in a diff

The diff viewer now waits for the GitHub session check before it shows the files. If the check
answered after the files appeared, each file got a "more unchanged context" row. The scroll height
did not include these rows, so the reader could not scroll to the end of the last file. A new
browser test delays the session answer and checks that the last file scrolls fully into view.

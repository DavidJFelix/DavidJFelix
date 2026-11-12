### perf(revision.city): redraw only the Symbols files that changed

The Symbols tab fills in one file at a time, and each result drew every file that the list already
showed again. On a large diff the total work grew with the square of the file count. Each file
section is now memoized, so a new result no longer draws the files that did not change. A new test
adds a second file and expects the first file's rows to draw only once.

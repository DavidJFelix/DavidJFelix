### fix(revision.city): tell each reviewer which files the pull request changes

Each reviewer saw one chunk of one file, with only the path of that file. On #823 to #826, 7 of the
9 false findings were about code in another file of the same pull request.

Now each chunk comes after a list of the files that the pull request changes, with the status of
each file. With tools, the prompt tells the reviewer to read the other file before it reports a
change as missing. The list stops at 10,000 characters. A push that adds or removes a file changes
the list, so the next run pays again for each chunk review.

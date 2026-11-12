### fix(revision.city): tell the reader which files Symbols did not read

The Symbols tab now shows one muted line, such as "2 files not read", when a file was too large to
read or its read failed. The line opens to name each file and its reason, and a Retry button asks
again for the failed files only. When no file changed a symbol but some files were not read, the
empty state says "No symbol changes in the files that were read". A file that the stream did not
answer now becomes an error and does not stay on "Reading" for good. A re-run with a new list of the
same files no longer leaves them in flight, because the effect cleanup now drops the files that are
still loading.

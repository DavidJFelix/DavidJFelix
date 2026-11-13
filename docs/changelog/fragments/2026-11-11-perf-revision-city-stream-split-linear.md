### perf(revision.city): split one large streamed patch file in linear time

The streamed patch parser no longer copies its whole buffer after each chunk. Chunks with no file
start wait in a list and join the buffer when a file start arrives. A diff with one file of 16 MiB
now splits in about 85 ms in place of about 1.3 seconds. Diffs of many small files take the same
time as before.

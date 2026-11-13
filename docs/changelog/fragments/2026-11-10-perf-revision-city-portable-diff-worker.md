### perf(revision.city): load the portable diff worker and preload three grammars

The diffs highlight workers now load the portable worker build of `@pierre/diffs`. The standard
build pulled every shiki grammar into the worker script, but a worker cannot load a grammar. The
worker script drops from 10.9 MB to 1.35 MB (about 0.5 MB gzip), and the Worker upload drops by
about 9 MiB, because the server build keeps a copy of the script. The worker pool and the main
thread highlighter now preload only `rust`, `tsx` and `typescript`; other languages load when a file
needs them. The local smoke check now fails when a client asset is larger than 2 MiB.

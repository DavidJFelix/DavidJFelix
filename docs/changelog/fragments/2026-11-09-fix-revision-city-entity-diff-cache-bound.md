### fix(revision.city): bound the shared caches of the GitHub file loader

The GitHub file loader keeps resolved refs and file bodies in two caches that live as long as the
Worker isolate. Before, an entry left a cache only when the same key was read again after it
expired, so the caches could grow without limit. Now the refs cache keeps at most 500 entries and
the file cache at most 64, the oldest entry goes first, and a file over 256,000 characters is read
but not kept.

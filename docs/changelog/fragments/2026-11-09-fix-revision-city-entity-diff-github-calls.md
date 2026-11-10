### fix(revision.city): cut the GitHub calls in the entity diff route

The Symbols route now reads all the GitHub files of one request through one reader, so it looks up
the diff's refs once per request. Before, a signed-in read skipped the shared cache and looked up
the pull request and its merge base again for each file: up to four GitHub calls per file instead of
two. The route also answers a file with no grammar (an image, a lockfile) with an empty result and
does not download it.

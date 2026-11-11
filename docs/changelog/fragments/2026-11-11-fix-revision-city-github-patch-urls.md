### fix(revision.city): build github.com patch URLs with the URL parser

The diff route built its github.com URLs by joining strings. A shared link with a `#` in a compare
ref fetched a cut ref, and a ref with non-ASCII characters made the `X-Patch-Source` header throw,
so the visitor got a 500. Now one helper sets the path through the URL parser, so a raw `#` and
`%23` fetch the same ref and the header stays ASCII. A path or URL with a tab or line break now gets
the 400 for a bad patch URL, because the parser would silently drop the character.

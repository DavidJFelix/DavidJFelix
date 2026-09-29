### feat(djf.io): React components in MDX posts, starting with BitView

djf.io posts can now be `.mdx` files that embed React components. The app adds `@astrojs/react`, and
the three readers that only matched `.md` (the blog collection's glob, the standard.site sync
script, and the em-dash/curly-quote prose check) now match `.mdx` too, so an MDX post is listed,
mirrored to ATProto, and prose-checked like any other. Components render to static HTML at build
time and ship JS only when a post adds a `client:*` directive.

The first component is `BitView`, the base figure for an upcoming post on quantization formats: the
bits stored in a `Uint8Array`, most significant first, grouped by byte, at any bit length (a 4-bit
value right-aligns in its byte). The pure reader behind it, `bitsByByte` in `src/lib/bits.ts`,
rejects byte counts that don't match the width, so a malformed figure fails the build rather than
rendering the wrong bits. Screen readers get a visually hidden summary with spaced digits instead of
the cells.

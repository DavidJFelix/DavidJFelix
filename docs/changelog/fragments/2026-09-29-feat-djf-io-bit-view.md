### feat(djf.io): React components in MDX posts, starting with BitView

djf.io posts can now be `.mdx` files that embed React components. The app adds `@astrojs/react`, and
the three readers that only matched `.md` (the blog collection's glob, the standard.site sync
script, and the em-dash/curly-quote prose check) now match `.mdx` too, so an MDX post is listed,
mirrored to ATProto, and prose-checked like any other. Components render to static HTML at build
time and ship JS only when a post adds a `client:*` directive.

The first component is `BitView`, the base figure for an upcoming post on quantization formats: the
bits of a `bigEndianBytes` array, most significant first, grouped by byte. A value starts at the top
of the first byte, and an optional one-byte `leastSignificantByteMask` says how much of the last
byte it uses: ones from the top, zeros from the least significant bit up (`0b11110000` for 4 bits).
The pure reader behind it, `bitsByByte` in `src/lib/bits.ts`, rejects any other mask, so a malformed
figure fails the build rather than rendering the wrong bits. Screen readers get a visually hidden
summary with spaced digits instead of the cells.

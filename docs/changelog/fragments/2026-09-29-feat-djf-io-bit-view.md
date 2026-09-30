### feat(djf.io): React components in MDX posts, starting with BitView

djf.io posts can now be `.mdx` files that embed React components. The app adds `@astrojs/react`, and
the three readers that only matched `.md` (the blog collection's glob, the standard.site sync
script, and the em-dash/curly-quote prose check) now match `.mdx` too, so an MDX post is listed,
mirrored to ATProto, and prose-checked like any other. Components render to static HTML at build
time and ship JS only when a post adds a `client:*` directive.

The first component is `BitView`, the base figure for an upcoming post on quantization formats: the
bits of a `bigEndianBytes` array, most significant first, grouped by byte. An optional `lsbBitMask`
of the same length picks the value's bits, ones from the least significant bit up (`0x0f` for a
4-bit value). The pure reader behind it, `bitsByByte` in `src/lib/bits.ts`, rejects a mask of any
other shape or length, so a malformed figure fails the build rather than rendering the wrong bits;
for arrays typed with a literal length, a mismatched mask is also a type error. Screen readers get a
visually hidden summary with spaced digits instead of the cells.

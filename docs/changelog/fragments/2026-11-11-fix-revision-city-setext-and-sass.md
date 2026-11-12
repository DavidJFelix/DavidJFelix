### fix(revision.city): name setext headings and parse indented Sass

The Symbols tab and the `read_definition` review tool now name Markdown headings that use an
underline (`===` or `---`), and a heading that runs over two lines gets both lines in its name. The
closing `---` of YAML front matter does not become a heading. `.sass` files now use the indented
Sass parser, so their rules and mixins have correct names; `.scss` files do not change.

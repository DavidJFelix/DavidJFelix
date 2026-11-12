### fix(revision.city): report C and C++ prototypes, globals and #define

The Symbols tab showed "No symbol changes" when a pull request changed only a C or C++ prototype, a
top-level global or a `#define`. A top-level declaration is now a symbol, of kind `function` when it
has a function declarator and `variable` otherwise, and a `#define` is a symbol of kind `macro`. An
`#include` and a declaration inside a function body still give no row.

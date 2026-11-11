### fix(revision.city): name C and C++ symbols from their own declarator

The Symbols tab now reads a C or C++ name from the declarator chain of its own declaration, not
from the first name anywhere in the signature. Constructors, operators and functions with default
arguments get their real names, so `read_definition` finds them too. A struct, class, union or enum
is an entity only when it has a body, so a struct type in a parameter list or a forward declaration
no longer shows as a new struct. Typedefs and unions are now entities, and a union has its own
`union` kind.

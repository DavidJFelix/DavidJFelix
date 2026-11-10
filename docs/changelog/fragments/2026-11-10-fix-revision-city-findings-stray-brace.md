### fix(revision.city): read a findings list that ends with stray braces

A review model can send its findings list as JSON text and then close that text with the braces of
the object around it, for example `[{...}]}`. The parse failed, so the chunk review failed and the
check went red with no finding. A JSON array never ends with a brace, so the reviewer now removes
trailing braces and white space from the text before it parses the list.

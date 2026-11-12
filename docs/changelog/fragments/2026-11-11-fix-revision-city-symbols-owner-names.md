### fix(revision.city): name Java fields, Rust impl blocks and Go methods by their owner

The Symbols tab now names a Java field without its initializer, so a changed value is one
`modified field` row and not a rename. Java records, compact constructors, `@interface` types and
interface constants are now symbols. A method in a generic or reference Rust impl has the name of
its type (`Stack.new`), and a Go method has the name of its receiver type (`Widget.Render`). The
reviewers' `read_definition` tool still finds a Go method by its bare name.

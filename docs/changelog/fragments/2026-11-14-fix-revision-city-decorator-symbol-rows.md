### fix(revision.city): give decorator and attribute changes a symbol row

In the Symbols tab, a changed decorator or attribute now gets a row on the declaration that it
marks: a Python `@app.route(...)` on its function, a Rust `#[derive(...)]` on its struct, and a
TypeScript `@Component(...)` above `export class` on the class. A changed method decorator or
attribute goes to the method, not to the enclosing class or impl. A decorated declaration now starts
at its first decorator, also in the lines that the reviewers' `read_definition` tool shows.

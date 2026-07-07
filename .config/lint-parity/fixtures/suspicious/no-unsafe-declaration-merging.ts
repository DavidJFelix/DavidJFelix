interface Foo {
    f(): void
}

class Foo {}

const foo = new Foo();
foo.f(); // Runtime Error: Cannot read properties of undefined.

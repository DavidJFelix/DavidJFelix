type Buzz = { qux: string };
type Baz = { buzz?: Buzz };
type Bar = { baz?: Baz };
type Foo = { bar?: Bar };

export function getBuzz(foo: Foo | undefined): Buzz | undefined {
  if (foo && foo.bar && foo.bar.baz && foo.bar.baz.buzz) {
    return foo.bar.baz.buzz;
  }
  return undefined;
}

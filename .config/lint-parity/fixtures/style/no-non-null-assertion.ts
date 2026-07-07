interface Example {
  property?: string;
}
declare const foo: Example;
const includesBaz = foo.property!.includes('baz');

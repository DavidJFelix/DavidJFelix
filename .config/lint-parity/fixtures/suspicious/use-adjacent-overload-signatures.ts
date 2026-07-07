type Foo = {
  foo_type(s: string): void;
  foo_type(n: number): void;
  bar_type(): void;
  foo_type(sn: string | number): void;
};

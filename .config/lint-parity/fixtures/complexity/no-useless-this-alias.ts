class A {
    method() {
        const self = this;
        return () => {
            return self;
        }
    }
}

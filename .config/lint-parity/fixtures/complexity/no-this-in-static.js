export class Registry {
	static defaults = { limit: 1 };

	static resolve() {
		return this.defaults;
	}

	constructor(name) {
		this.name = name;
	}
}

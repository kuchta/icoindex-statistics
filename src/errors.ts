export class MyError extends Error {
	error?: MyError;
	object?: object;
	code?: number;

	constructor(readonly message: string, { error, object }: { error?: Error, object?: Object } = {}) {
		super(message);
		this.error = error;
		this.object = object;
		if (this.error && this.error.code) {
			this.code = this.error.code;
		}
	}

	toString() {
		let msg = this.message;
		if (this.code) {
			msg = `${msg} (code: ${this.code})`;
		}
		return msg;
	}
}

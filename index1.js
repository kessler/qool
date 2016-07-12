'use strict'

const debug = require('debug')('levelq')

class Levelq {
	constructor(db) {
		this._db = db
		this._data = db.sublevel('data')
		this._meta = db.sublevel('meta')

		this._counter = 0

		setInterval(() => {
			debug('reset key counter')
			this._counter = 0
		}, 1000)

		this._initLog()
		this._loop()
	}

	enqueue(data, cb) {
		debug('enqueue()', data)
		let key = [Date.now(), this._counter++]

		// check if previous entry in the log is a batch
		// other instantiate one
		let batch = this._log[this._log.length - 1]
		if (!(batch instanceof EnqueueBatch)) {
			batch = new EnqueueBatch()
			this._log.push(batch)
		}

		batch.push(key, data, cb)

		// this is much slower than batching
		// this._log.push(new EnqueueOp(key, data, cb))
	}

	dequeue(timeout, cb) {
		debug('dequeue()')
		if (typeof(timeout) === 'function') {
			cb = timeout
			timeout = -1
		}

		//  check if previous entry in the log is a batch
		//  other instantiate one
		let batch = this._log[this._log.length - 1]
		if (!(batch instanceof DequeueBatch)) {
			batch = new DequeueBatch()
			this._log.push(batch)
		}

		batch.push(new DequeueOp(timeout, cb))
	}

	_loop() {
		if (this._log.length === 0) {
			return setImmediate(() => {
				this._loop()
			})
		}

		let log = this._log.reverse()
		this._initLog()

		let exec = () => {

			if (log.length === 0) {
				return this._loop()
			}

			log.pop().execute(this._data, this._meta, exec)
		}

		exec()
	}

	_initLog() {
		this._log = [] //new Array(10000)
	}
}

class EnqueueOp {
	constructor(key, value, cb) {
		this.key = key
		this.value = value
		this.cb = cb
	}

	execute(data, meta, internalCb) {
		data.put(this.key, this.value, (err) => {
			internalCb()
			this.cb(err)
		})
	}
}

class EnqueueBatch {
	constructor() {
		this.callbacks = []
		this.batch = []
		this.current = 0
	}

	execute(data, meta, cb) {
		data.batch(this.batch, (err) => {
			this._done(err, cb)
		})
	}

	push(key, value, cb) {
		this.batch.push({ key, value, type: 'put' })
		this.callbacks.push(cb)
	}

	_done(err, cb) {
		for (let i = 0; i < this.callbacks.length; i++) {
			let callback = this.callbacks[i]
			if (callback) {
				callback(err)
			}
		}

		cb(err)
	}
}

class DequeueOp {
	constructor(timeout, cb) {
		this.cb = cb
		this.timeout = timeout
		this.bookmark = undefined
		this.result = undefined
		this.error = undefined
	}

	execute(data, meta, internalCb) {
		let entry, error
		let opts = {
			limit: 1,
			gt: this.bookmark
		}

		data.createReadStream(opts)
			.once('data', (_entry) => {
				this.result = _entry
			})
			.once('error', (err) => {
				err = error
			})
			.once('close', () => {
				if (error) {
					this.error = error
					return internalCb(error)
				}

				internalCb()
			})
	}
}

/**
 * 	perform multiple dequeu ops, deleting entries
 *	once the batch is complete 
 *	this speeds up things significantly
 *
 */
class DequeueBatch {
	constructor() {
		this.ops = []
		this.deletion = []
		this.current = 0
	}

	execute(data, meta, cb) {
		debug('DequeueBatch:execute()')

		/**
		 *	recursively execute single dequeue ops
		 *	passing the last dequeue key to the next
		 *	to be used as a bookmark to start the read stream
		 *
		 *	all the individual dequeue user callbacks
		 *	are executed at the end of the batch
		 *	to prevent the user from reading the database
		 *	in the middle of a batch
		 */
		let execute = (bookmark) => {
			if (bookmark) this.deletion.push({ key: bookmark, type: 'del' })

			// when the batch is complete
			if (this.current === this.ops.length) {
				return this._done(null, data, cb)
			}

			let op = this.ops[this.current++]
			op.bookmark = bookmark
			op.execute(data, meta, (err) => {
				if (err) {
					return this._done(err, data, cb)
				}
				let key
				if (op.result) {
					key = op.result.key
				}
				execute(key)
			})
		}

		execute()
	}

	push(op) {
		this.ops.push(op)
	}

	// TODO make this code less ugly
	_done(err, data, cb) {

		debug('deleting %d keys', this.deletion.length)
			// first delete all successful dequeue ops
		data.batch(this.deletion, () => {
			let errored = false

			// iterate over all dequeue ops
			// if an operation errored, all following operations
			// are considered failed
			for (let i = 0; i < this.ops.length; i++) {
				let op = this.ops[i]

				if (op.error) {
					errored = true
					if (op.cb) {
						op.cb(err)
					}
					continue
				}

				if (!op.cb) continue

				if (errored) {
					op.cb(new Error('previous operation failed'))
				} else {
					op.cb(null, op.result ? op.result.value : undefined)
				}
			}

			cb()
		})
	}
}

module.exports = Levelq

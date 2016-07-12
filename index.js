'use strict'

const debug = require('debug')('qool')

class Qool {
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
		if (!batch) {
			batch = new OpsBatch()
			this._log.push(batch)
		}

		if (batch.ops.length > 100) {
			batch = new OpsBatch()
			this._log.push(batch)	
		}

		batch.push(new EnqueueOp(key, data, cb))

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
		if (!batch) {
			batch = new OpsBatch()
			this._log.push(batch)
		}

		if (batch.ops.length > 10) {
			batch = new OpsBatch()
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

/**
 *
 */
class OpsBatch {
	constructor() {
		this.batch = []
		this.ops = []
		this.currentIndex = 0
		this.bookmark = undefined
		this.start = undefined
	}

	execute(data, meta, cb) {
		debug('execute() %d ops from %d', this.ops.length, this.currentIndex)

		let executeOp = (op) => {
			return op.execute(this, data, (err, bookmark) => {
				if (err) {
					// break the batch
					return this.done(err, data, cb)
				}

				// update the bookmark
				if (bookmark) { 
					this.bookmark = bookmark
				}
				
				if (op.batchOp) {
					this.batch.push(op.batchOp)
				}

				this.currentIndex++
				this.execute(data, meta, cb)
			})
		}

		for (;this.currentIndex < this.ops.length; this.currentIndex++) {
			let op = this.ops[this.currentIndex]
			
			let proceed = executeOp(op)

			if (!proceed) {
				return
			}
			
			this.batch.push(op.batchOp)
		}

		this.done(null, data, cb)
	}

	push(op) {
		debug('OpsBatch: push()')
		this.ops.push(op)
	}

	done(err, data, cb) {
		debug('OpsBatch: done()')
		if (err) {
			for (let i =  0; i < this.currentIndex; i++) {
				this.ops[i].done(err)
			}

			cb(err)
			return
		}

		debug('OpsBatch: done() 0 => %d', this.currentIndex)
		
		// we;re done so call all the cbs after batch
		data.batch(this.batch, (err) => {

			for (let i =  0; i < this.currentIndex; i++) {
				this.ops[i].done(err)
			}

			cb(err)
		})
	}
}

class DequeueOp {
	constructor(timeout, userCb) {
		this.batchOp = undefined
		this.timeout = timeout // not operational yet
		this.userCb = userCb
		this.value = undefined
		this.error = undefined
		this.bookmark = undefined
	}

	execute(batch, data, cb) {
		debug('DequeueOp: execute()')
		let lastPut = findUnclaimedPut(batch.ops, batch.currentIndex)
		if (lastPut) {
			lastPut.claim()
			this.batchOp = new DelOp(lastPut.batchOp.key)
			this.value = lastPut.batchOp.value
			return true
		}

		this._getHead(batch.bookmark, data, cb)
	}

	done(err) {
		if (this.userCb) {
			debug('DequeueOp: done()')
			this.userCb(err || this.error, this.value)
		}
	}

	_getHead(bookmark, data, cb) {
		debug('_getHead(%s)', bookmark)
		let entry, error
		let opts = {
			limit: 1,
			gt: bookmark
		}

		data.createReadStream(opts)
			.once('data', (_entry) => {
				this.value = _entry.value
				this.bookmark = _entry.key
			})
			.once('error', (err) => {
				err = error
			})
			.once('close', () => {
				if (error) {
					this[ERROR] = error
					return cb(error)
				}

				if (this.bookmark) {
					this.batchOp = new DelOp(this.bookmark)
				}

				cb(null, this.bookmark)
			})
	}
}

class EnqueueOp {
	constructor(key, value, userCb) {
		this.batchOp = new PutOp(key, value)
		this.userCb = userCb
		this.claimed = false
		this.error = undefined
	}

	execute(batch, data, cb) {
		debug('EnqueueOp: execute()')
		return true
	}

	isClaimed() {
		debug('EnqueueOp: isClaimed()')
		return this.claimed
	}

	claim() {
		debug('EnqueueOp: claim()')
		this.claimed = true
	}

	done(err) {
		if (this.userCb) {
			debug('EnqueueOp: done()')
			this.userCb(err || this.error)
		}
	}
}

class DelOp {
	constructor(key) {
		this.type = 'del'
		this.key = key
	}
}

class PutOp {
	constructor(key, value) {
		this.type = 'put'
		this.key = key
		this.value = value
	}
}

function findUnclaimedPut(ops, pos) {
	for (let i = 0; i < pos; i++) {
		let op = ops[i]
		if (!(op instanceof EnqueueOp)) continue;

		if (!op.isClaimed()) {
			return op
		}
	}
}

module.exports = Qool

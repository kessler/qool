'use strict'

const debug = require('debug')('qool')

class Qool {
	constructor(db) {
		this._db = db
		this._data = db.sublevel('data')
		this._meta = db.sublevel('meta')
		this._batchSize = 1000
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
		this._pushToBatch(new EnqueueOp(key, data, cb))
	}

	dequeue(timeout, cb) {
		debug('dequeue()')
		if (typeof(timeout) === 'function') {
			cb = timeout
			timeout = -1
		}

		this._pushToBatch(new DequeueOp(timeout, 'def', cb))
	}

	_pushToBatch(op) {
		let batch = this._log[this._log.length - 1]
		if (!batch || (batch.ops.length > this._batchSize)) {
			batch = new UnifiedBatch(this._data, this._batchSize)
			this._log.push(batch)
		}

		batch.push(op)
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

			log.pop().execute(this._data, exec)
		}

		exec()
	}

	_initLog() {
		this._log = [] //new Array(10000)
	}
}

class UnifiedBatch {
	constructor(data, maxBatchSize) {
		this.data = data
		this.ops = new Array(maxBatchSize)
		this.opsIndex = 0

		this.batch = new Array(maxBatchSize)
		this.batchIndex = 0

		this.length = 0
		this.lastPushedOp = {}
		this.bookmark = undefined

		this.enqueue = new Array(maxBatchSize)
		this.enqueueIndex = 0

		this.executeCallback = (err, op, results, cb) => {
			if (err) {
				return this.done(err, cb)
			}

			// means we read ahead for several dequeues
			for (let i = 1; i < results.length; i++) {
				this.ops[this.currentIndex + i].result = results[i]
				this.bookmark = results[i]
			}
			console.log(op, results.length)
			
			// also need to make sure that db contained enough 
			// results, otherwise we need to check pending enqueues
			for (let i = results.length; i < op.track; i++) {
				let lastPut = this.getLastPut()
				if (lastPut) {
					this.ops[this.currentIndex + i].result = lastPut.value
				}
			}
			
			this.opsIndex++
			op.addToBatch(this.batch, this.batchIndex++)

			this.execute(cb)
		}
	}

	execute(cb) {

		for (; this.opsIndex < this.length; this.opsIndex++) {
			let op = this.ops[this.opsIndex]
			op.bookmark = this.bookmark
			let proceed = op.execute(this.data, this.executeCallback, cb)

			if (proceed) {
				return
			}

			op.addToBatch(this.batch, this.batchIndex++)
		}

		this.done(null, cb)
	}

	done(err, cb) {
		debug('UnifiedBatch: done() 0 => %d', this.opsIndex)

		if (err) {
			for (let i = 0; i < this.opsIndex; i++) {
				let op = this.ops[i]
				if (op.cb) {
					op.cb(err)
				}
			}

			cb(err)
			return
		}

		// we're done so call all the cbs after batch
		this.data.batch(this.batch.slice(0, this.batchIndex), (_err) => {

			for (let i = 0; i < this.opsIndex; i++) {
				let op = this.ops[i]
				if (op.cb) {
					op.cb(_err)
				}
			}

			cb(err)
		})
	}

	push(op) {
		debug('UnifiedBatch: push()')

		if (isSameType(op, this.lastPushedOp)) {
			this.lastPushedOp.track++
		} else {
			this.lastPushedOp = op
		}

		this.ops[this.length++] = op

		if (op instanceof EnqueueOp) {
			this.enqueue[this.enqueueIndex++] = op
		}
	}

	getLastPut() {
		let lastPut = this.enqueue[this.enqueueIndex]
		if (lastPut) {
			this.enqueueIndex++
		}

		return lastPut
	}
}

//[e,e,d,d,d,d,e,e]

function isSameType(a, b) {
	return a.constructor === b.constructor
}

class EnqueueOp {
	constructor(key, data, cb) {
		this.key = key
		this.data = data
		this.cb = cb
		this.track = 1
		this.bookmark = undefined
	}

	execute(data, cb) {
		return false
	}

	addToBatch(batch, batchIndex) {
		batch[batchIndex] = new PutOp(this.ket, this.data)
	}
}

const EMPTY = []

class DequeueOp {
	constructor(timeout, topic, cb) {
		this.timeout = timeout
		this.topic = topic
		this.cb = cb
		this.result = undefined
		this.track = 1
		this.bookmark = undefined
	}

	execute(data, cb, internalCb) {
		debug('FetchOp.execute()')

		if (this.result) {
			return true
		}

		let results = new Array(this.track)
		let actual = 0
		let error

		let stream = data.createReadStream({
			limit: this.track,
			gt: this.bookmark
		})

		stream.once('data', (entry) => {
			results[actual++] = entry.value
		})

		stream.once('error', (err) => {
			err = error
			stream.destroy()
		})

		stream.once('close', () => {
			if (error) {
				return cb(error)
			}

			if (actual > 0) {
				this.result = results[0]
				cb(null, this, results.slice(0, actual), internalCb)
			} else {
				cb(null, this, EMPTY, internalCb)
			}
		})

		return false
	}

	addToBatch(batch, index) {
		batch[index] = new DelOp(this.result)
	}
}

/**
 *
 */
class UnifiedBatch1 {
	constructor(maxBatchSize) {
		// since we're initializing these arrays we need to keep track of the actual
		// length to avoid processing undefined members
		this.ops = new Array(maxBatchSize)
		this.length = 0
		this.currentIndex = 0

		this.enqueueIndex = new Array(maxBatchSize)
		this.enqueueIndexLength = 0
		this.currentEnqueueIndex = 0

		this.batch = new Array(maxBatchSize)
		this.batchLength = 0

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
					this.batch[this.batchLength++] = op.batchOp
				}

				this.currentIndex++
				this.execute(data, meta, cb)
			})
		}

		for (; this.currentIndex < this.length; this.currentIndex++) {
			let op = this.ops[this.currentIndex]

			let proceed = executeOp(op)

			if (!proceed) {
				return
			}

			this.batch[this.batchLength++] = op.batchOp
		}

		this.done(null, data, cb)
	}

	push(op) {
		debug('UnifiedBatch: push()')
		this.ops[this.length++] = op
		if (op instanceof EnqueueOp) {
			this.enqueueIndex[this.enqueueIndexLength++] = op
		}
	}

	done(err, data, cb) {
		debug('UnifiedBatch: done() 0 => %d', this.currentIndex)
		if (err) {
			for (let i = 0; i < this.currentIndex; i++) {
				this.ops[i].done(err)
			}

			cb(err)
			return
		}

		// we're done so call all the cbs after batch
		data.batch(this.batch.slice(0, this.batchLength), (err) => {

			for (let i = 0; i < this.currentIndex; i++) {
				this.ops[i].done(err)
			}

			cb(err)
		})
	}

	getLastPut() {
		let lastPut = this.enqueueIndex[this.currentEnqueueIndex]
		if (lastPut) {
			this.currentEnqueueIndex++
		}

		return lastPut
	}
}

class DequeueOp1 {
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
		let lastPut = batch.getLastPut()

		if (lastPut) {
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
					this.error = error
					return cb(error)
				}

				if (this.bookmark) {
					this.batchOp = new DelOp(this.bookmark)
				}

				cb(null, this.bookmark)
			})
	}
}

class EnqueueOp1 {
	constructor(key, value, userCb) {
		this.batchOp = new PutOp(key, value)
		this.userCb = userCb
		this.error = undefined
	}

	execute(batch, data, cb) {
		debug('EnqueueOp: execute()')
		return true
	}

	done(err) {
		if (this.userCb) {
			debug('EnqueueOp: done()')
			this.userCb(err || this.error)
		}
	}
}

class FetchOp {
	constructor(howMany, bookmark) {
		this._opts = {
			gt: bookmark,
			limit: howMany
		}
	}

	execute(batch, data, cb) {
		
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

module.exports = Qool

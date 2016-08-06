'use strict'

const debug  = require('./debug')('SmartBatch')
const debugSilly = require('./debug')('SmartBatch:silly')
const ReadOp = require('./ReadOp')
const CompoundKeySet = require('./CompoundKeySet')

class SmartBatch {
	constructor(db, leases) {
		this._db = db
		this._leases = leases || new CompoundKeySet()
		this._deletions = new CompoundKeySet()
		this._batch = []
		
		// if we have dequeues, we will store results from the
		// database here
		this._dequeueBuffer = undefined
		this._dequeueOpsCount = 0
		this._enqueueOpsCache = []
		this._executeCb = undefined
	}

	push(op) {
		debugSilly('push()', op)
		
		this._batch.push(op)

		if (isEnqueue(op)) {
			return this._enqueueOpsCache.push(op)
		}

		if (isDelete(op)) {
			this._deletions.add(op.key)
		}

		if (isDequeue(op)) {
			return this._dequeueOpsCount++
		}

		throw new Error('invalid operation for this batch [' + op.type + ']')
	}

	execute(cb) {
		debugSilly('execute()')
		this._executeCb = this._executeCb || cb
		
		// if we have dequeues we're gonna fetch all their data at once
		// _prefetchDequeue will call execute again when it's finished
		if (!this._dequeueBuffer && this._dequeueOpsCount > 0) {
			return this._prefetchDequeue()
		}

		let enqueues = this._enqueueOpsCache.length

		debug('execute() enqueues %d', enqueues)

		// database didn't contain enough data to fullfill all dequeues
		// so we'll merge the pending enqueues into the dequeue buffer
		if (this._dequeueBuffer && this._dequeueBuffer.length < this._dequeueOpsCount) {
			debug('execute() not enough data for to fullfill all pending dequeues')

			for (let i = 0; i < this._dequeueOpsCount && i < this._enqueueOpsCache.length; i++) {
				let enqueueOp = this._enqueueOpsCache[i]
				
				// we'll use this to filter enqueue ops from the batch
				enqueueOp.ignore = true

				// we'll use this later to determine the size of the final batch
				enqueues--

				this._dequeueBuffer.push(enqueueOp)
			}
		}

		let finalBatch = []

		for (let i = 0, di = 0; i < this._batch.length; i++) {
			let entry = this._batch[i]

			// take dequeue results from the buffer, but if the buffer is empty
			// then there is nothing more to dequeue
			// if/when we want waiting dequeues, here might be a good
			// spot to put them into a next batch or something
			if (isDequeue(entry) && di < this._dequeueBuffer.length) {
				let dequeueResult = this._dequeueBuffer[di++]
				//debug(entry, di, fi, dequeueResult)
				entry.key = dequeueResult.key
				entry.value = dequeueResult.value
			}

			// an ignored entry is usually an enqueue operation
			// that was claimed for a dequeue operation when
			// the database is empty
			if (!entry.ignore) {
				finalBatch.push(entry)
			}
		}

		debugSilly('execute() finalBatch:', finalBatch)
		debug('execute() actual batch size is %d', finalBatch.length)
		debug('execute() start batch')

		this._db.batch(finalBatch, (err) => {
			debug('execute() batch complete')
			this._fireCallbacks(err)
			setImmediate(() => {
				this._executeCb(err)
			})
		})
	}

	get length() {
		return this._batch.length
	}

	get batchType() {
		return 'SmartBatch'
	}

	/**
	 *	once we execute the SmartBatch, we're gonna get all the 
	 *	data that will be dequeued in a single batch operation
	 *
	 */
	_prefetchDequeue() {
		debugSilly('_prefetchDequeue()')
		let readOp = new ReadOp(this._db, { limit: this._dequeueOpsCount, filter: this._filter() })
		readOp.execute((err, results) => {
			if (err) {
				debug('_prefetchDequeue error ', err)
				this._fireCallbacks(err)
				return setImmediate(() => {
					this._executeCb(err)
				})
			}

			this._dequeueBuffer = results || []

			this.execute()
		})
	}

	_fireCallbacks(err) {
		for (let i = 0; i < this._batch.length; i++) {
			let entry = this._batch[i]

			if (entry.userCb) {
				entry.userCb(err, entry.value)
			}
		}
	}

	_filter() {
		return entry => {
			return this._leases.has(entry.key) || this._deletions.has(entry.key)
		}
	}
}

module.exports = SmartBatch

function isSameType(a, b) {
	return a.constructor === b.constructor
}

function isDelete(op) {
	return op.type === 'del' && op.key
}

function isDequeue(op) {
	return op.type === 'del'
}

function isEnqueue(op) {
	return op.type === 'put'
}
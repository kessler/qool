'use strict'
const debug  = require('./debug')('SmartBatch')
const debugSilly = require('./debug')('SmartBatch:silly')

class SmartBatch {
	constructor(db) {
		this.db = db

		this.batch = []

		// if we have dequeues, we will store results from the
		// database here
		this.dequeueBuffer = undefined
		this.dequeueOpsCount = 0

		this.enqueueOpsCache = []
	}

	push(op) {
		debugSilly('push()', op)		
		
		this.batch.push(op)

		if (isEnqueue(op)) {
			this.enqueueOpsCache.push(op)
		} else {
			this.dequeueOpsCount++
		}
	}

	execute(cb) {
		debugSilly('execute()')
		this.executeCb = this.executeCb || cb
		
		// if we have dequeues we're gonna fetch all their data at once
		// _prefetchDequeue will call execute again when it's finished
		if (!this.dequeueBuffer && this.dequeueOpsCount > 0) {
			this.dequeueBuffer = []

			return this._prefetchDequeue()
		}

		let enqueues = this.enqueueOpsCache.length

		debug('execute() enqueues %d', enqueues)

		// database didn't contain enough data to fullfill all dequeues
		// so we'll merge the pending enqueues into the dequeue buffer
		if (this.dequeueBuffer && this.dequeueBuffer.length < this.dequeueOpsCount) {
			debug('execute() not enough data for to fullfill all pending dequeues')

			for (let i = 0; i < this.dequeueOpsCount && i < this.enqueueOpsCache.length; i++) {
				let enqueueOp = this.enqueueOpsCache[i]
				
				// we'll use this to filter enqueue ops from the batch
				enqueueOp.ignore = true

				// we'll use this later to determine the size of the final batch
				enqueues--

				this.dequeueBuffer.push(enqueueOp)
			}
		}

		//let finalLength = put + this.dequeueOpsCount
		//debug('execute() finalLength is %d', this.batch.length)

		let finalBatch = []

		for (let i = 0, di = 0; i < this.batch.length; i++) {
			let entry = this.batch[i]

			// take dequeue results from the buffer, but if the buffer is empty
			// then there is nothing more to dequeue
			// if/when we want waiting dequeues, here might be a good
			// spot to put them into a next batch or something
			if (isDequeue(entry) && di < this.dequeueBuffer.length) {
				let dequeueResult = this.dequeueBuffer[di++]
				//debug(entry, di, fi, dequeueResult)
				entry.key = dequeueResult.key
				entry.value = dequeueResult.value
			}

			if (!entry.ignore) {
				finalBatch.push(entry)
			}
		}

		debugSilly('execute() finalBatch:', finalBatch)
		debug('execute() actual batch size is %d', finalBatch.length)
		debug('execute() start batch')

		this.db.batch(finalBatch, (err) => {
			debug('execute() batch complete')
			this.fireCallbacks(err)
			setImmediate(() => {
				this.executeCb(err)
			})
		})
	}

	/**
	 *	once we execute the SmartBatch, we're gonna get all the 
	 *	data that will be dequeued in one batch
	 *
	 */
	_prefetchDequeue() {
		debugSilly('_prefetchDequeue()')
		
		let error
		let stream = this.db.createReadStream({ limit: this.dequeueOpsCount })
		let start = Date.now()

		stream.on('data', (entry) => {
			debugSilly('readStream data', entry)
			this.dequeueBuffer.push(entry)
		})

		stream.once('error', (err) => {
			error = err
			stream.destroy()
		})

		stream.on('close', () => {
			debug('_prefetchDequeue() stream close')

			if (error) {
				debug('_prefetchDequeue error ', error)
				return this.fireCallbacks(err)
			}

			debug('_prefetchDequeue() took %d', Date.now() - start)
			this.execute()
		})
	}

	fireCallbacks(err) {
		for (let i = 0; i < this.batch.length; i++) {
			let entry = this.batch[i]

			if (entry.userCb) {
				entry.userCb(err, entry.value)
			}
		}
	}
}

module.exports = SmartBatch

function isSameType(a, b) {
	return a.constructor === b.constructor
}

function isDequeue(op) {
	return op.type === 'del'
}

function isEnqueue(op) {
	return op.type === 'put'
}
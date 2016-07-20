'use strict'
const debug  = require('./debug')('SmartBatch')
const debugSilly = require('./debug')('SmartBatch:silly')

class SmartBatch {
	constructor(db, maxSize) {
		this.db = db

		this.batch = new Array(maxSize)

		// incremented during push
		this.length = 0

		// incremented during execution
		this.currentIndex = 0

		// count how many dequeued items (dels)	
		// and enqueued items (puts) were pushed to this batch
		// dequeues may dequeue more than one item in one operation
		this.del = 0
		this.put = 0

		// if we have dequeues, we will store results from the
		// database here
		this.dequeueBuffer = undefined
		this.dequeueBufferLength = 0

		this.enqueueOpsCache = new Array(maxSize)
		this.enqueueOpsCacheLength = 0
	}

	push(op) {
		debugSilly('push()', op)		
		
		this[op.type]++
		
		this.batch[this.length++] = op

		if (isEnqueue(op)) {
			this.enqueueOpsCache[this.enqueueOpsCacheLength++] = op
		} else {
			this.dequeueOpsCount++
		}
	}

	execute(cb) {
		debugSilly('execute()')
		this.executeCb = this.executeCb || cb
		
		// if we have dequeues we're gonna fetch all their data at once
		// _prefetchDequeue will call execute again when it's finished
		if (!this.dequeueBuffer && this.del > 0) {
			this.dequeueBuffer = new Array(this.del)

			return this._prefetchDequeue()
		}

		// database didn't contain enough data to fullfill all dequeues
		// so we'll merge the pending enqueues into the dequeue buffer
		if (this.dequeueBufferLength < this.del) {
			debug('execute() not enough data for to fullfill all pending dequeues')

			for (let i = 0; i < this.del && i < this.enqueueOpsCacheLength; i++) {
				let enqueueOp = this.enqueueOpsCache[i]
				
				// we'll use this to filter enqueue ops from the batch
				enqueueOp.ignore = true

				// we'll use this later to determine the size of the final batch
				this.put--

				this.dequeueBuffer[this.dequeueBufferLength++] = enqueueOp
			}
		}

		let finalLength = this.put + this.del
		debug('execute() finalLength = %d', finalLength)

		let finalBatch = new Array(finalLength)

		for (let i = 0, di = 0, fi = 0; i < this.length; i++) {
			let entry = this.batch[i]

			// take dequeue results from the buffer, but if the buffer is empty
			// then there is nothing more to dequeue
			// if/when we want waiting dequeues, here might be a good
			// spot to put them into a next batch or something
			if (isDequeue(entry) && di < this.dequeueBufferLength) {
				let dequeueResult = this.dequeueBuffer[di++]
				//debug(entry, di, fi, dequeueResult)
				entry.key = dequeueResult.key
				entry.value = dequeueResult.value
			}

			if (!entry.ignore) {
				finalBatch[fi++] = entry
			}
		}

		debugSilly('execute() finalBatch:', finalBatch)
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
		let stream = this.db.createReadStream({ limt: this.del })
		let start = Date.now()

		stream.on('data', (entry) => {
			debugSilly('readStream data', entry)
			this.dequeueBuffer[this.dequeueBufferLength++] = entry
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
		for (let i = 0; i < this.length; i++) {
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
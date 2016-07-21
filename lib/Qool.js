'use strict'

const debug = require('./debug')('main')
const debugSilly = require('./debug')('main:silly')
const DequeueOp = require('./DequeueOp')
const EnqueueOp = require('./EnqueueOp')
const SmartBatch = require('./SmartBatch')

class Qool {
	constructor(db) {
		this._db = db
		this._data = db.sublevel('data')
		this._meta = db.sublevel('meta')
		this._counter = 0
		this._isLooping = false

		setInterval(() => {
			debugSilly('reset key counter')
			this._counter = 0
		}, 1000).unref()

		this._newBatch()
	}

	/**
	 *	enqueue an item
	 *
	 *	@param {Object} data
	 *	@param {Function} cb - (err) => {} - this parameter is optional
	 *
	 *	@returns {Array} a positional key of this item in the queue, this can be used with peek
	 *
	 */
	enqueue(data, cb) {
		debugSilly('enqueue()', data)
		let key = [Date.now(), this._counter++]
		this._pushToBatch(new EnqueueOp(key, data, cb))
		return key
	}

	/**
	 *	Dequeue one item from the queue
	 *
	 *	@param {Function} cb - (err, value) => {} - this parameter is optional
	 *
	 */
	dequeue(cb) {
		debugSilly('dequeue()')
		this._pushToBatch(new DequeueOp(cb))
	}

	/**
	 *	Get a peek of first N items in the queue.
	 *	The peek operation starts from the top of the queue.
	 *	Use a bookmark in the options to change the starting point.
	 *
	 *	@param {Object} options 
	 *	@param {Number} options.length - maximum items returned
	 *	@param {Array} options.bookmark - where to start the peek operation from
	 */
	peek(options, cb) {
		debugSilly('peek()')

		let opts
		if (typeof options === 'function') {
			cb = options
			opts = { limit : 1 }
		} else {
			opts = {
				limit: options.length,
				gt: options.bookmark
			}
		}

		let error
		let result = []
		let stream = this._data.createReadStream(opts)

		stream.on('data', (entry) => {
			result.push(entry.value)
		})

		stream.once('error', (err) => {
			error = err
			stream.destroy()
		})

		stream.on('close', () => {
			if (error) return cb(error)

			cb(null, result)
		})
	}

	_pushToBatch(op) {
		
		this._batch.push(op)

		if (!this._isLooping) {
			this._isLooping = true
			setImmediate(() => {
				this._loop()
			})
		}
	}

	_loop() {

		if (this._batch.length === 0) {
			debug('batch empty')
			return
		}

		debug('loop start')
		
		let currentBatch = this._batch
		
		this._newBatch()

		debug('executing, batch length %d', currentBatch.length)
		currentBatch.execute((err) => {
			this._isLooping = false
				// TODO throw an error
			debug('loop done')
		})
	}

	_newBatch() {
		debug('creating new batch')
		this._batch = new SmartBatch(this._data)
	}
}

module.exports = Qool
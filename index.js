'use strict'

const debug = require('./lib/debug')('main')
const debugSilly = require('./lib/debug')('main:silly')
const DequeueOp = require('./lib/DequeueOp')
const EnqueueOp = require('./lib/EnqueueOp')
const SmartBatch = require('./lib/SmartBatch')

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

		//this._initLog()
		this._newBatch()
	}

	enqueue(data, cb) {
		debugSilly('enqueue()', data)
		let key = [Date.now(), this._counter++]
		this._pushToBatch(new EnqueueOp(key, data, cb))
	}

	dequeue(cb) {
		debugSilly('dequeue()')
		this._pushToBatch(new DequeueOp(cb))
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

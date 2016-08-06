'use strict'

const debug  = require('./debug')('ReadBatch')
const debugSilly = require('./debug')('ReadBatch:silly')
const ReadOp = require('./ReadOp')
const CompoundKeySet = require('./CompoundKeySet')

class ReadBatch {
	constructor(db, leases) {
		this._callbacks = []
		this._db = db
		this._leases = leases || new CompoundKeySet()
	}

	push(op) {
		debugSilly('push()', op)
		this._callbacks.push(op.userCb)
	}
	
	execute(cb) {
		debugSilly('execute()')
		
		if (this.length === 0) {
			return setImmediate(cb)
		}

		let readOp = new ReadOp(this._db, { limit: this.length, filter: this._filter() })

		readOp.execute((err, results) => {
			debugSilly('execute() readop finished')
			this._readOpDone(err, results)
			setImmediate(cb)
		})
	}

	get length() {
		return this._callbacks.length
	}

	get batchType() {
		return 'ReadBatch'
	}

	_filter() {
		return entry => {
			return this._leases.has(entry.key)
		}
	}

	_readOpDone(err, results) {
		if (err) {
			for (let i = 0; i < this._callbacks.length; i++) {
				this._callbacks[i](err)
			}

			return
		}

		for (let i = 0; i < this._callbacks.length; i++) {
			let callback = this._callbacks[i]
			
			if (i < results.length) {
				let result = results[i]
				callback(null, result.key, result.value)
			} else {
				callback()
			}			
		}
	}
}

module.exports = ReadBatch
'use strict'

const debug = require('./debug')('ReadBatch')
const debugSilly = require('./debug')('ReadBatch:silly')
const ReadOp = require('./ReadOp')
const CompoundKeySet = require('./CompoundKeySet')

// TODO this is in fact lease and peek batch
// lease is only a read operation in relation to the database
// but in fact once a row is leased it should not be visible to 
// subsequent peeks
class ReadBatch {
	constructor(db, leases) {
		this._ops = []
		this._db = db
		this._leases = leases || new CompoundKeySet()
		this._totalReads = 0
		this._peekLength = 0
		this._readLength = 0
	}

	push(op) {
		debugSilly('push()', op)
		this._ops.push(op)
		let length = (op.length || 1)

		if (isPeek(op)) {
			this._peekLength = op.length > this._peekLength ? op.length : this._peekLength
		} else {
			this._readLength += length
		}
	}

	execute(cb) {
		debugSilly('execute()')

		if (this.length === 0) {
			return setImmediate(cb)
		}

		let limit = this._readLength + this._peekLength

		let readOp = new ReadOp(this._db, { limit, filter: this._filter() })

		readOp.execute((err, results) => {
			debugSilly('execute() readop finished')
			this._readOpDone(err, results)
			setImmediate(cb)
		})
	}

	get length() {
		return this._ops.length
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
		if (err || results.length === 0) {
			for (let i = 0; i < this._ops.length; i++) {
				this._ops[i].userCb(err)
			}

			return
		}

		for (let i = 0, x = 0; i < this._ops.length; i++) {
			let op = this._ops[i]

			if (isPeek(op)) {
				op.userCb(null, results.slice(x, op.length))
				continue
			}

			if (x > results.length) {
				op.userCb()
				continue
			}

			op.userCb(null, results.slice(x, op.length))
			x += op.length
		}
	}
}

// TODO have to refactor the entire code to get read of these if statements all over
// probably with Ops being able to operate on the batch instead of the other way around
function isPeek(op) {
	return op.type === 'peek'
}

function isRead(op) {
	return op.type === 'read'
}

module.exports = ReadBatch

'use strict'

const expect = require('chai').expect
const SmartBatch = require('../lib/SmartBatch')
const DequeueOp = require('../lib/DequeueOp')
const EnqueueOp = require('../lib/EnqueueOp')

const Readable = require('readable-stream').Readable
const os = require('os')
const _ = require('lodash')

describe('SmartBatch', () => {
	let batch, db

	it('executes operations in fifo order', (done) => {
		let calls = { dequeue: 0, enqueue: 0 }

		batch.push(new DequeueOp(1, (err, value) => {
			if (err) return done(err)
			calls.dequeue++
			expect(value).to.equal(1)
		}))

		batch.push(new EnqueueOp('e', 5, (err) => {
			if (err) return done(err)
			calls.enqueue++
		}))

		batch.execute((err) => {
			if (err) return done(err)
			expect(calls.dequeue).to.equal(1)
			expect(calls.enqueue).to.equal(1)
			done()
		})
	})

	beforeEach(() => {
		db = new MockDb()
		batch = new SmartBatch(db, 10)
	})
})

class MockDb {
	constructor() {
		this.db = {
			a: 1,
			b: 2,
			c: 3,
			d: 4
		}
	}

	createReadStream() {
		
		return new MockStream(this.db)
	}

	batch(data, cb) {
		_.forEach(data, (entry) => {
			if (entry.type === 'del') {
				return delete this.db[entry.key]
			}

			if (entry.type === 'put') {
				return this.db[entry.key] = entry.value
			}
		})

		cb()
	}
}

class MockStream extends Readable {

	constructor(data) {
		super({ objectMode: true })

		this._data = data
	}

	_read(size) {
		_.forEach(this._data, (v, k) => {
			this.push({ key: k, value: v})
		})

		this.push(null)
		setImmediate(() => {
			this.emit('close')
		})
	}

	destroy() {
		this.emit('close')
	}
}

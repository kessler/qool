'use strict'

const expect = require('chai').expect
const SmartBatch = require('../lib/SmartBatch')
const DequeueOp = require('../lib/DequeueOp')
const EnqueueOp = require('../lib/EnqueueOp')

const Readable = require('readable-stream').Readable
const os = require('os')
const _ = require('lodash')
const topic = 'def'

describe('SmartBatch', () => {
	let batch, db

	it('executes operations in fifo order', (done) => {
		let ops = []
		batch.push(new DequeueOp((err, value) => {
			if (err) return done(err)
			ops.push(value)
		}))

		batch.push(new EnqueueOp('e', 5, (err) => {
			if (err) return done(err)
			ops.push('enqueue')
		}))

		batch.execute((err) => {
			if (err) return done(err)
			expect(ops).to.have.length(2)
			expect(ops[0]).to.equal(1)
			expect(ops[1]).to.equal('enqueue')
			expect(db.data).to.have.property('e', 5)
			done()
		})
	})

	it('fullfills dequeue requests from memory when database is empty', (done) => {
		
		batch.push(new DequeueOp((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(1)
		}))

		batch.push(new DequeueOp((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(2)
		}))

		batch.push(new DequeueOp((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(3)
		}))

		batch.push(new DequeueOp((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(4)
		}))

		batch.push(new DequeueOp((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(5)
		}))

		batch.push(new EnqueueOp('g', 5, (err) => {
			if (err) return done(err)
		}))

		batch.execute((err) => {
			if (err) return done(err)
			done()
		})
	})

	it('stops if an error occurs and calls all the callbacks with the error', (done) => {
		db.error = new Error('test')

		let ops = []
		batch.push(new DequeueOp((err) => {
			ops.push({ type: 'dequeue', error: err })
		}))

		batch.push(new EnqueueOp('e', 5, (err) => {
			ops.push({ type: 'enqueue', error: err })
		}))

		batch.execute((err) => {
			expect(err).to.equal(db.error)
			expect(ops).to.have.length(2)
			expect(ops[0]).to.have.property('type', 'dequeue')
			expect(ops[0].error).to.equal(db.error)

			expect(ops[1]).to.have.property('type', 'enqueue')
			expect(ops[1].error).to.equal(db.error)

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
		// this is not the best data structure to use 
		// since in a real queue we can have multiple a:1 for 
		// example
		this.data = {
			a: 1,
			b: 2,
			c: 3,
			d: 4
		}
	}

	createReadStream() {
		return new MockStream(this.data)
	}

	batch(data, cb) {

		if (this.error) {
			return setImmediate(() => {
				cb(this.error)
			})
		}

		_.forEach(data, (entry) => {
			if (entry.type === 'del') {
				return delete this.data[entry.key]
			}

			if (entry.type === 'put') {
				return this.data[entry.key] = entry.value
			}
		})

		setImmediate(cb)
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

'use strict'

const expect = require('chai').expect
const SmartBatch = require('../lib/SmartBatch')

const Readable = require('readable-stream').Readable
const os = require('os')
const _ = require('lodash')

describe('SmartBatch', () => {
	let batch, db

	it('executes operations in fifo order', (done) => {
		let ops = []

		batch.push({
			type: 'del',
			userCb: (err, value) => {
				if (err) return done(err)
				ops.push(value)
			}
		})

		batch.push({
			type: 'put',
			key: 'e',
			value: 5,
			userCb: (err) => {
				if (err) return done(err)
				ops.push('enqueue')
			}
		})
		
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

		batch.push({
			type: 'del',
			userCb: (err, value) => {
				if (err) return done(err)
				expect(value).to.equal(1)
			}
		})

		batch.push({
			type: 'del',
			userCb: (err, value) => {
				if (err) return done(err)
				expect(value).to.equal(2)
			}
		})

		batch.push({
			type: 'del',
			userCb: (err, value) => {
				if (err) return done(err)
				expect(value).to.equal(3)
			}
		})

		batch.push({
			type: 'del',
			userCb: (err, value) => {
				if (err) return done(err)
				expect(value).to.equal(4)
			}
		})

		batch.push({
			type: 'del',
			userCb: (err, value) => {
				if (err) return done(err)
				expect(value).to.equal(5)
			}
		})

		batch.push({
			type: 'put',
			key: 'g',
			value: 5,
			userCb: (err) => {
				if (err) return done(err)
			}
		})

		batch.execute((err) => {
			if (err) return done(err)
			done()
		})
	})

	it('stops if an error occurs and calls all the callbacks with the error', (done) => {
		db.error = new Error('test')

		let ops = []
		batch.push({
			type: 'del',
			userCb: (err) => {
				ops.push({ type: 'dequeue', error: err })
			}
		})

		batch.push({
			type: 'put',
			key: 'e',
			value: 5,
			userCb: (err) => {
				ops.push({ type: 'enqueue', error: err })
			}
		})

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
		batch = new SmartBatch(db)
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
			d: 4,
			e: 5
		}
	}

	createReadStream(opts) {
		return new MockStream(this.data, opts)
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

	constructor(data, opts) {
		super({ objectMode: true })
		this._keys = Object.keys(data)
		this._limit = opts.limit || this._keys.length
		this._data = data
	}

	_read(size) {
		for (let i = 0; i < this._limit; i++) {
			let key = this._keys[i]
			let value = this._data[key]
			this.push({ key, value })
		}

		this.push(null)
		setImmediate(() => {
			this.emit('close')
		})
	}

	destroy() {
		this.emit('close')
	}
}

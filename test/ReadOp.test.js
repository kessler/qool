'use strict'

const expect = require('chai').expect
const ReadOp = require('../lib/ReadOp')
const _ = require('lodash')

const Readable = require('readable-stream').Readable

describe('ReadOp', () => {
	let db

	it('Performs a read operation', (done) => {

		let readOp = new ReadOp(db)

		readOp.execute((err, results) => {
			if (err) return done(err)

			expect(results).to.have.length(4)

			expect(results[0]).to.eql({ key: 'a', value: 1 })
			expect(results[1]).to.eql({ key: 'b', value: 2 })
			expect(results[2]).to.eql({ key: 'c', value: 3 })
			expect(results[3]).to.eql({ key: 'd', value: 4 })

			done()
		})
	})

	it('limit results', (done) => {

		let readOp = new ReadOp(db, { limit: 2 })

		readOp.execute((err, results) => {
			if (err) return done(err)

			expect(results).to.have.length(2)
			expect(results[0]).to.eql({ key: 'a', value: 1 })
			expect(results[1]).to.eql({ key: 'b', value: 2 })

			done()
		})
	})

	it('filter results', (done) => {
		let readOp = new ReadOp(db, {
			filter: (entry) => {
				if (entry.value === 3) return true
			}
		})

		readOp.execute((err, results) => {
			if (err) return done(err)

			expect(results).to.have.length(3)

			expect(results[0]).to.eql({ key: 'a', value: 1 })
			expect(results[1]).to.eql({ key: 'b', value: 2 })
			expect(results[2]).to.eql({ key: 'd', value: 4 })

			done()
		})
	})

	beforeEach(() => {
		db = new MockDb()
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

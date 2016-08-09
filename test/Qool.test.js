'use strict'

const Qool = require('../lib/Qool.js')
const expect = require('chai').expect
const level = require('level-bytewise')
const rimraf = require('rimraf')
const path = require('path')
const cma = require('cumulative-moving-average')
const SmartBatch = require('../lib/SmartBatch')
const ReadOp = require('../lib/ReadOp')

describe('Qool', () => {
	let db, data, size, queue

	it('dequeues in the reverse order items were enqueued', (done) => {
		queue.enqueue(1)
		queue.enqueue(2)
		queue.enqueue(3)
		queue.dequeue((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(1)
		})

		queue.dequeue((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(2)
		})

		queue.dequeue((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(3)
		})

		queue.enqueue(4)
		queue.dequeue((err, value) => {
			if (err) return done(err)
			expect(value).to.equal(4)
			done()
		})
	})

	it('dequeue on an empty queue', (done) => {
		queue.dequeue()
		queue.enqueue(1)
		queue.dequeue((err, value) => {
			if (err) return done(err)
			done()
		})
	})

	it('peeking at the top of the queue', (done) => {
		queue.enqueue(1)
		queue.enqueue(2, (err) => {
			if (err) return done(err)
			queue.peekMany(2, (err, results) => {
				if (err) return done(err)
				expect(results[0].value).to.eql(1)
				expect(results[1].value).to.eql(2)
				done()
			})
		})
	})

	it('lease and peek', (done) => {
		queue.enqueue(1)
		queue.enqueue(2)
		queue.enqueue(3)
		queue.enqueue(4, (err) => {
			if (err) return done(err)

			queue.peek((err, value) => {
				if (err) return done(err)
				expect(value).to.equal(1)
			})

			queue.lease((err, key, value) => {
				if (err) return done(err)
				expect(value).to.eql(1)
				done()
			})

			queue.lease((err, key, value) => {
				if (err) return done(err)
				expect(value).to.eql(2)
				done()
			})

			// here we expect to get 3 and 4, because 1 and 2
			// were leased
			queue.peekMany(2, (err, results) => {
				if (err) return done(err)
				expect(results[0].value).to.equal(3)
				expect(results[1].value).to.equal(4)
				done()
			})
		})
	})

	it('delete a specific item from the queue', (done) => {
		let key = queue.generateKey()
		queue.enqueueWithKey(key, 1, (err) => {
			if (err) return done(err)
			queue.delete(key, (err) => {
				if (err) return done(err)
				queue.peek((err, key, value) => {
					if (err) return done(err)
					expect(value).to.equal(undefined)
					done()
				})
			})
		})
	})

	it('leasing an item from the queue will make it invisible to other processes', (done) => {
		let key = queue.generateKey()
		queue.enqueueWithKey(key, 1, (err) => {
			if (err) return done(err)
			queue.lease((err, leaseKey, value) => {
				if (err) return done(err)
				expect(key).to.eql(key)
				expect(value).to.equal(1)
				queue.dequeue((err, value) => {
					if (err) return done(err)
					expect(value).to.equal(undefined)
					done()
				})
			})
		})
	})

	it('a lease on an item will expire', function(done) {
		this.timeout(4000)

		let key = queue.generateKey()
		queue.enqueueWithKey(key, 1, (err) => {
			if (err) return done(err)

			// lease for 1 second
			queue.leaseWithTimeout(1000, (err, leaseKey, value) => {
				setTimeout(() => {
					queue.dequeue((err, value) => {
						if (err) return done(err)
						expect(value).to.equal(1)
						done()
					})
				}, 2000)
			})
		})
	})

	it('a lease on an item will become permanent when calling delete()', function(done) {
		this.timeout(4000)

		let key = queue.generateKey()
		queue.enqueueWithKey(key, 1, (err) => {
			if (err) return done(err)

			// lease for 1 second
			queue.leaseWithTimeout(1000, (err, leaseKey, value) => {
				queue.delete(key, (err) => {
					setTimeout(() => {
						queue.dequeue((err, value) => {
							if (err) return done(err)
							expect(value).to.equal(undefined)
							done()
						})
					}, 2000)
				})
			})
		})
	})

	it.skip('forwards any errors to the caller, if a callback is provided', () => {

	})


	beforeEach(() => {

		if (db) {
			db.close()
		}

		let dbPath = path.join(__dirname, 'db')

		rimraf.sync(dbPath)
		db = level(dbPath)
		data = db.sublevel('data')
		size = 1000
		queue = new Qool(db)
	})
})

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

	describe('tests', () => {

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
				queue.peek((err, key, value) => {
					if (err) return done(err)
					expect(value).to.eql(1)
				})
				queue.peek((err, key, value) => {
					if (err) return done(err)
					expect(value).to.eql(2)
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

		it('leasing an item from the queue will make it invisible to other processes',  (done) => {
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

		it('a lease on an item will become permanent when calling delete()', function (done) {
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
	})

	describe.skip('bench', () => {
		it('enqueue', function (done) {
			this.timeout(100000)

			let count = 0
			let avg = cma()
			for (let i = 0; i < size; i++) {
				enqueue(i)
			}

			console.log(1)

			function enqueue(i) {
				let start = Date.now()
				queue.enqueue(i, (err) => {
					avg.push(Date.now() - start)
					if (err) return done(err)
					count++
				})
			} 

			function check() {
				if (count === size) {
					console.log(avg.value / 1000, avg.length)
					let afterCount = 0
					db.sublevel('data').createReadStream()
						.on('data', (e) => {
							expect(e.value).to.equal(afterCount++)
						})
						.on('end', () => {
							expect(afterCount).to.equal(size)
							done()
						})
				} else {
					setImmediate(check)
				}
			}

			check()
		})

		it('dequeue', function(done) {
			this.timeout(2000000)
			let avg = cma()
			let count = 0

			console.time('put')
			for (let i = 0; i < size; i++) {
				data.put([Date.now(), i], i + 'xyz')
			}

			console.timeEnd('put')

			setTimeout(test, 5000)

			function dequeue() {
				let start = Date.now()
				queue.dequeue((err, item) => {
					avg.push(Date.now() - start)
					if (err) return done(err)
					count++
				})
			}

			function test() {
				let testStart = Date.now()
				console.time('start')
				for (let i = 0; i < size; i++) {
					dequeue()
				}
				console.timeEnd('start')

				function check() {
					if (count === size) {
						console.log(avg.value / 1000, avg.length)
						let afterCount = 0
						db.sublevel('data').createReadStream()
							.on('data', () => {
								afterCount++
							})
							.on('end', () => {
								console.log('test time: %d', Date.now() - testStart)
								expect(afterCount).to.equal(0)	
								done()
							})
					} else {
						setImmediate(check)
					}
				}

				check()
			}
		})

		it('mixed', function (done) {
			this.timeout(100000)

			let count = 0
			let dequeueAvg = cma()
			let enqueueAvg = cma()
			let testStart = Date.now()

			for (let i = 0; i < size; i++) {
				if (i % 4 === 0) {
					enqueue(i)
				} else {
					dequeue(i)
				}
			}

			console.log(1)

			setTimeout(test, 5000)

			function enqueue(i) {
				let start = Date.now()
				queue.enqueue(i, (err) => {
					enqueueAvg.push(Date.now() - start)
					if (err) return done(err)
					count++
				})
			}

			function dequeue() {
				let start = Date.now()
				queue.dequeue((err, item) => {
					dequeueAvg.push(Date.now() - start)
					if (err) return done(err)
					count++
				})
			}

			function test() {
				function check() {
					if (count === size) {
						console.log('batch size %d', queue._batchSize)
						console.log('dequeue: %d', dequeueAvg.value / 1000, dequeueAvg.length)
						console.log('enqueue: %d', enqueueAvg.value / 1000, enqueueAvg.length)
						console.log('test end %d', Date.now() - testStart)
						done()
					} else {
						setImmediate(check)
					}
				}

				check()
			}
		})
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

'use strict'
const implementation = './index.js'
console.log(implementation)
const Qool = require(implementation)
const expect = require('chai').expect
const level = require('level-bytewise')
const rimraf = require('rimraf')
const memwatch = require('memwatch-next')
const path = require('path')
const cma = require('cumulative-moving-average')

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

			for (let i = 0; i < size; i++) {
				data.put([Date.now(), i], i + 'xyz')
			}

			console.log(1)

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

				for (let i = 0; i < size; i++) {
					dequeue()
				}

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
		size = 100000
		queue = new Qool(db)
	})
})

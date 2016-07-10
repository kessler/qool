'use strict'

const Levelq = require('../index.js')
const expect = require('chai').expect
const level = require('level-bytewise')
const rimraf = require('rimraf')
const memwatch = require('memwatch-next')
const path = require('path')
const cma = require('cumulative-moving-average')

describe('Levelq', () => {
	let db, data, size, queue

	describe('enqueue', () => {
		it('enqueue', function (done) {
			this.timeout(100000)

			let count = 0
			let avg = cma()
			for (let i = 0; i < size; i++) {
				enqueue(i)
			}

			function enqueue(i) {
				let start = Date.now()
				queue.enqueue(i, (err) => {
					if (err) return done(err)
					avg.push(Date.now() - start)
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
	})

	describe('dequeue', () => {
		it('dequeue', function(done) {
			this.timeout(200000)
		
			let count = 0
			for (let i = 0; i < size / 2; i++) {
				queue.dequeue((err, item) => {
					if (err) return done(err)
					count++
				})
			}

			function check() {
				if (count === size / 2) {
					let afterCount = 0
					db.sublevel('data').createReadStream()
						.on('data', () => {
							afterCount++
						})
						.on('end', () => {
							expect(afterCount).to.equal(count)
							done()
						})
				} else {
					setImmediate(check)
				}
			}

			check()			
		})

		beforeEach(function(done) {
			this.timeout(20000)

			for (let i = 0; i < size; i++) {
				data.put([Date.now(), i], i + 'xyz')
			}
			console.log(1)
			setTimeout(() => {
				done()
			}, 2000)
		})
	})

	describe.only('order', () => {
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
				done()
			})
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
		size = 1000000
		queue = new Levelq(db)
	})
})

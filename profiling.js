'use strict'

const Qool = require('./lib/Qool')
const level = require('level-bytewise')
const rimraf = require('rimraf')
const path = require('path')
const async = require('async')
const _ = require('lodash')

let iterator = async.compose(
	all,
	(index, cb) => {
		console.log('starting cycle %d', index)	
		console.log('deleting database')
		rimraf(path.join(__dirname, 'db'), cb)
	}
)

const ITERATIONS = 100

async.timesSeries(ITERATIONS, iterator, (err, results) => {
	if (err) return console.error(err)
	console.log('avg: %d', results.reduce((sum, member) => { return sum + member }) / ITERATIONS)
})

function all(cb) {
	
	const db = level('db')
	const queue = new Qool(db)
	const SIZE = process.argv[2] || 100000
	const ENQUEUE_SIZE = SIZE / 4

	let popCount = 0
	
	function checkPopDone(err) {
		
		if (err) {
			console.log(err)
			return process.exit(1)
		}

		if (++popCount === ENQUEUE_SIZE) {
			console.timeEnd('populate database')
			test()
		}
	}

	console.time('populate database')
	
	for (let i = 0; i < ENQUEUE_SIZE; i++) {
		queue.enqueue(i + 'zz', checkPopDone)
	}

	function test() {
		
		const stats = {
			dequeue: 0,
			enqueue: 0
		}

		// i % selector to decide if we do an enqueue or dequeue
		const selector = 3

		let count = 0

		//console.time('test')
		let start = Date.now()
		for (let i = 0; i < SIZE; i++) {
			if (i % selector === 0) {
				enqueue(i)
			} else {
				dequeue(i)
			}
		}

		function enqueue(i) {
			queue.enqueue(i, (err) => {
				stats.enqueue++
			
				handleError(err)
				checkDone()
			})
		}

		function dequeue() {
			queue.dequeue((err) => {
				stats.dequeue++

				handleError(err)
				checkDone()
			})
		}

		function checkDone() {
			if (count++ === SIZE - 1) {
				let end = Date.now() - start
				console.log('took %ds', end / 1000)
				console.log('done')
				console.log(stats)
				db.close()
				cb(null, end)
			}
		}

		function handleError(err) {
			if (err) {
				console.error(err)
				process.exit(1)
			}
		}
	}
}


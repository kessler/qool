'use strict'

const Qool = require('./index')
const level = require('level-bytewise')

const db = level('db')
const queue = new Qool(db)
const SIZE = process.argv[2] || 100000
const stats = {
	dequeue: 0,
	enqueue: 0
}

// i % selector to decide if we do an enqueue or dequeue
const selector = 3

let count = 0

for (let i = 0; i < SIZE; i++) {
	if (i % selector === 0) {
		//enqueue(i)
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
		console.log('done')
		console.log(stats)
		process.exit(0)
	}
}

function handleError(err) {
	if (err) {
		console.error(err)
		process.exit(1)
	}
}

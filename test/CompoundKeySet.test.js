'use strict'
const CompoundKeySet = require('../lib/CompoundKeySet')
const expect = require('chai').expect

describe('CompoundKeySet', () => {
	let set

	it('stores lease keys', () => {
		let item = [12312323, 1]
		expect(set.has(item)).to.be.false
		set.add(item)
		expect(set.has(item)).to.be.true
	})

	it('can delete stored keys', () => {
		let item = [12312323, 1]
		set.add(item)
		set.delete(item)
		expect(set.has(item)).to.be.false
	})

	it('delete operations return true if the operation actually deleted something, false otherwise', () => {
		let item = [12312323, 1]
		set.add(item)
		expect(set.delete(item)).to.be.true
		expect(set.delete(item)).to.be.false
	})

	it('delete a whole range', () => { 
		set.add([1, 1])
		set.add([2, 1])
		set.add([2, 2])
		set.deleteRange(2)
		expect(set.has([2, 1])).to.be.false
		expect(set.has([2, 2])).to.be.false
	})

	it('iterations are over the prefixes only', () => {
		set.add([1, 1])
		set.add([2, 1])
		set.add([2, 2])
		let iteration = []
		for (let x of set) {
			iteration.push(x)
		}

		expect(iteration).to.eql([1, 2])
	})

	beforeEach(() => {
		set = new CompoundKeySet()
	})
})
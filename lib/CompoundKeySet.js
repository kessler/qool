'use strict'

//TODO might be better to subclass Set and override?
//TODO refactoring needed
class CompoundKeySet {

	constructor() {
		this._map = new Map()
	}

	add(item) {
		if (!Array.isArray(item)) throw new Error('must be an array')
		if (item.length < 2) throw new Error('array must have a minimal length of 2')

		let prefix = item[0]
		let suffix = item[1]

		let entry = this._map.get(prefix)

		if (!entry) {
			entry = new Set()
			this._map.set(prefix, entry)
		}

		entry.add(suffix)
	}

	delete(item) {
		
		let prefix = item[0]
		let suffix = item[1]

		let entry = this._map.get(prefix)

		// nothing to delete
		if (!entry) {
			return false
		}

		entry.delete(suffix)

		if (entry.size === 0) {
			this._map.delete(prefix)
		}

		return true
	}

	deleteRange(prefix) {
		return this._map.delete(prefix)
	}

	has(item) {

		let prefix = item[0]
		let suffix = item[1]

		let entry = this._map.get(prefix)

		if (!entry) return false

		return entry.has(suffix)
	}

	[Symbol.iterator]() {
		return this._map.keys()
	}
}

module.exports = CompoundKeySet
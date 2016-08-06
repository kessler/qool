'use strict'

const debug = require('./debug')('main')
const debugSilly = require('./debug')('main:silly')
const SmartBatch = require('./SmartBatch')
const ReadBatch = require('./ReadBatch')
const ReadOp = require('./ReadOp')
const LinkedList = require('digital-chain')
const CompoundKeySet = require('./CompoundKeySet')

class Qool {
	constructor(db, dataSublevel, defaultLeaseTimeout) {
		this._db = db
		this._data = db.sublevel(dataSublevel || 'data')
		this._counter = 0
		this._isLooping = false
		this._label = Date.now()
		this._opsQueue = new LinkedList()
		this._currentBatch = undefined
		this._defaultLeaseTimeout = defaultLeaseTimeout || (1000 * 10) // default lease is 10 seconds
		this._leases = new CompoundKeySet()

		this._initKeyStateGenerator()
		this._initLeaseTimeoutMonitor()
	}

	/**
	 *	enqueue an item
	 *
	 *	@param {Object} data
	 *	@param {Function} cb - (err) => {} - this parameter is optional
	 *
	 *	@returns {Array} a positional key of this item in the queue, this can be used with peek
	 *
	 */
	enqueue(value, userCb) {
		debugSilly('enqueue()')
		let key = this.generateKey()
		this.enqueueWithKey(key, value, userCb)
		return key
	}

	/**
	 *	Same as enqueue but without auto key generation
	 *
	 *	This method is provided for custom ordering or for
	 *	clients that need to use the default key generated with
	 *	generateKey() 
	 *
	 *	for this queue to function properly, the key must
	 *	be sortable in a way that leveldb will read those keys
	 *	in the order they were inserted.
	 */
	enqueueWithKey(key, value, userCb) {
		debugSilly('enqueueWithKey()')
		this._pushToOpsQueue({ type: 'put', key, value, userCb})
	}

	/**
	 *	Dequeue one item from the queue
	 *
	 *	@param {Function} cb - (err, value) => {} - this parameter is optional
	 *
	 */
	dequeue(userCb) {
		debugSilly('dequeue()')
		this._pushToOpsQueue({ type: 'del', userCb })
	}

	/**
	 *	Leasing an item from the queue, will temporarily dequeue it. 
	 *	The item will not be visible to other operations.
	 *	It will also not be delete from the underlying database.
	 *
	 *	The item will "reappear" after a predefined timeout or once the process that hosts
	 *	the queue restarts.
	 *
	 *	A lease can be xxx()ed during the lifetime of the queue process, which will make
	 *	it permanent (i.e the item will be removed from the database)
	 *
	 */
	lease(userCb) {
		debugSilly('lease()')
		this.leaseWithTimeout(this._defaultLeaseTimeout, userCb)		
	}

	leaseWithTimeout(timeout, userCb) {
		this._pushToOpsQueue({ type: 'read', userCb: (err, key, value) => {
			this._leaseCallback(err, timeout, key, value, userCb)
		}})
	}

	delete(key, userCb) {
		this._leases.delete(key)
		this._pushToOpsQueue({ type: 'del', key: key, userCb })
	}

	peek(userCb) {
		this._pushToOpsQueue({ type: 'read', userCb })
	}

	_leaseCallback(err, timeout, leaseKey, value, userCb) {
		if (err) return userCb(err)
		this._leases.add(leaseKey)
		userCb(null, leaseKey, value)
	}

	generateKey() {
		debugSilly('generateKey()')
		return [this._label, this._counter++]
	}

	// TODO need to refactor all these if op === something
	// also in smart batch
	_pushToOpsQueue(op) {
		debugSilly('_pushToOpsQueue() %o', op)
		let currentBatch = this._currentBatch

		if ((!currentBatch || currentBatch instanceof SmartBatch) 
			&& op.type === 'read') {

			debugSilly('_pushToOpsQueue() creating new ReadBatch')
			this._currentBatch = currentBatch = new ReadBatch(this._db, this._leases)
			this._opsQueue.unshift(currentBatch)

		} else if ((!currentBatch || currentBatch instanceof ReadBatch) 
			&& (op.type === 'del' || op.type === 'put') ) {
			debugSilly('_pushToOpsQueue() creating new SmartBatch')
			this._currentBatch = currentBatch = new SmartBatch(this._db, this._leases)
			this._opsQueue.unshift(currentBatch)			
		}

		this._currentBatch.push(op)

		if (!this._isLooping) {
			this._isLooping = true
			setImmediate(() => {
				this._loop()
			})
		}
	}

	_loop() {
		debug('_loop()')

		let currentBatch = this._opsQueue.pop()
		if (this._currentBatch === currentBatch) {
			this._currentBatch = undefined
		}

		if (currentBatch.length === 0) {
			debug('batch empty')
			return
		}

		debug('_loop() executing, batch: { type: [%s], length [%d] } opsQueue: { length:%d }', 
			currentBatch.batchType, currentBatch.length, this._opsQueue.length)

		// TODO this error is also forwarded to all user callbacks from enqueue/dequeue operations
		// should we also emit an error event here perhaps?
		currentBatch.execute((err) => {
			debug('_loop() batch done')

			if (this._opsQueue.length > 0) {
				return setImmediate(() => {
					this._loop()
				})
			}

			this._isLooping = false
		})
	}

	// TODO improve this, see redis probablistic expiry algorithm
	_initLeaseTimeoutMonitor() {
		setInterval(() => {
			let expire = Date.now() + this._defaultLeaseTimeout
			for (let timestamp of this._leases) {
				if (timestamp < expire) {
					this._leases.deleteRange(timestamp)
				}
			}
		}, 1000).unref()
	}

	_initKeyStateGenerator() {
		setInterval(() => {
			this._counter = 0
			this._label = Date.now()
		}, 1000).unref()
	}
}

module.exports = Qool

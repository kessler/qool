'use strict'

const debug = require('./debug')('ReadOp')
const debugSilly = require('./debug')('ReadOp:silly')

/**
 *	an abstraction over db.createReadStream()
 *
 *	ReadOp is a buffering operation, meaning it will hold all the results in memory
 *	It also supports filtering during the reading of the results stream
 *
 *	All the other createReadStream() options can be specified in the constructor
 */
class ReadOp {

	/**
	 *	@param {Object} db - a reference to a leveldb or sublevel
	 *	@param {Object} opts
	 *	@param {Number} opts.limit - how many rows to read
	 *	@param {Variant} opts.gt - leveldb gt options param
	 *	@param {Variant} opts.lt - leveldb gt options param
	 *	@param {Function} opts.filter - a filtering function of the form function(entry) { return true|false}, 
	 *						returning true will excluse the entry from the ReadOp results
	 *
	 */
	constructor(db, opts) {
		this._db = db
		this._opts = opts || {}
		this._results = []
		this._filter = this._opts.filter || defaultFilter
	}

	execute(cb) {
		debugSilly('execute()')
		let error
		let stream = this._db.createReadStream(this._opts)
		let start = Date.now()

		stream.on('data', (entry) => {
			debugSilly('readStream data', entry)
			if (!this._filter(entry)) {
				this._results.push(entry)
			}
		})

		stream.once('error', (err) => {
			error = err
			stream.destroy()
		})

		stream.on('close', () => {
			debug('_read() stream close')

			if (error) {
				debug('_read error ', error)
				return cb(error)
			}

			debug('_execute() took %d', Date.now() - start)
			return cb(null, this._results)
		})
	}
}

function noop() {}
function defaultFilter() { return false }

module.exports = ReadOp

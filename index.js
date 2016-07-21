const Qool = require('./lib/Qool')

module.exports.create = (db) => {
	return new Qool(db)
}

module.exports.Queue = Qool

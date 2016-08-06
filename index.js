const Qool = require('./lib/Qool')

module.exports.create = (db, defaultLeaseTimeout) => {
	return new Qool(db, defaultLeaseTimeout)
}

module.exports.createCustom = (db, customDataSublevel, defaultLeaseTimeout) => {
	return new Qool(db, customDataSublevel, defaultLeaseTimeout)	
}

module.exports.Queue = Qool

const debug = require('debug')

module.exports = (name) => {
	return debug('qool:' + name)
}
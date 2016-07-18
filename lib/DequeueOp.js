'use strict'

class DequeueOp {
	constructor(size, userCb) {
		// this is undefined because this value 
		// will only be populated after we read 
		// from the database
		this.key = undefined
		this.type = 'del'
		this.userCb = userCb
		this.size = size
	}
}

module.exports = DequeueOp
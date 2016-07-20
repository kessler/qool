'use strict'

class DequeueOp {
	constructor(userCb) {
		// this is undefined because this value 
		// will only be populated after we read 
		// from the database
		this.key = undefined
		this.type = 'del'
		this.userCb = userCb
	}
}

module.exports = DequeueOp
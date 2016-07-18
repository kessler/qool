'use strict'

class EnqueueOp {
	constructor(key, value, userCb) {
		this.key = this.key
		this.value = value
		this.type = 'put'
		this.userCb = userCb
		this.size = 0
	}
}

module.exports = EnqueueOp
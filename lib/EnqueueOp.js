'use strict'

class EnqueueOp {
	constructor(key, value, userCb) {
		this.key = key
		this.value = value
		this.type = 'put'
		this.userCb = userCb
	}
}

module.exports = EnqueueOp
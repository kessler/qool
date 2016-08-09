# qool

**a leveldb backed [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))**

[![npm status](http://img.shields.io/npm/v/qool.svg?style=flat-square)](https://www.npmjs.org/package/qool) 

- durable
- strict FIFO ordering
- dequeus with timeouts (called lease())
- embeddable

## Example

### Simple
```javascript
const Qool = require('qool')
const level = require('level-bytewise')

const db = level('db')
const queue = Qool.create(db)

queue.enqueue('a')
queue.enqueue('b', (err) => {})

queue.dequeue()
queue.dequeue((err, value) => {})
```
##### notes
Enqueue and Dequeue are batched under the hood, so callbacks are invoked synchronously. This means that you can only include a last callback and forgo all the others for Enqueues and Dequeues that happen in the same tick

### Lease
```javascript
const Qool = require('qool')
const level = require('level-bytewise')

const db = level('db')
const queue = Qool.create(db, 1000 * 10)

queue.enqueue('a')
queue.enqueue('b', (err) => {})

queue.lease((err, leaseKey, value) => {
    // do something with the data

    // delete the item permanently from the queue
    queue.delete(leaseKey, (err) => {

    })
})

// TBD
// lease with a non default timeout
//queue.leaseWithTimeout(1000 * 2, (err, leaseKey, value) => {})
```

### Peek
```javascript
const Qool = require('qool')
const level = require('level-bytewise')

const db = level('db')
const queue = Qool.create(db)

queue.enqueue('a')
queue.enqueue('b', (err) => {})

queue.peek((err, value) => {
    // value === 'a'
})

queue.peekMany((err, results) => {
    // results === [{ key: ..., value: 'a' }, { key: ..., value: 'b' }]
})
```

Some ramblings on internal design are [here](./notes.md)

## license

### TODO
- enhance tests
- implement length property
- should we have a version of dequeue that "waits" if the queue is empty
- expiry for enqueued items

[MIT](http://opensource.org/licenses/MIT) © yaniv kessler

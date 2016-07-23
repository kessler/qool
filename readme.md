# qool (WIP)

**a leveldb backed [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))**

[![npm status](http://img.shields.io/npm/v/qool.svg?style=flat-square)](https://www.npmjs.org/package/qool) 

## Features
- durable queue
- strict FIFO ordering of enqueue and dequeue operations
- batching for level db mutating operations (del, put)

## Example

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

Some ramblings on internal design are [here](./notes.md)

## license

### TODO
- enhance tests
- implement length property
- should we have a version of dequeue that "waits" if the queue is empty

[MIT](http://opensource.org/licenses/MIT) © yaniv kessler

# qool (WIP)

**a leveldb backed [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))**

[![npm status](http://img.shields.io/npm/v/levelq.svg?style=flat-square)](https://www.npmjs.org/package/levelq) 

## Features
- strict FIFO ordering of enqueue and dequeue operations
- batching for level db mutating operations (del, put)

## Example

```javascript
const Qool = require('qool')
const level = require('level-bytewise')

const db = level('db')
const queue = new Qool(db)

queue.enqueue('a')
queue.enqueue('b', (err) => {})

queue.dequeue()
queue.dequeue((err, value) => {})
```

Some initial benchmarks and ramblings on internal design are [here](./bench.md)

## license

### TODO
- enhance tests
- code is a little messy
- implement length property
- should we have a version of dequeue that "waits" if the queue is empty
- implement timeout on dequeue (item shows up on the queue again)

[MIT](http://opensource.org/licenses/MIT) © yaniv kessler

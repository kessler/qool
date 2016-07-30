# qool

**a leveldb backed [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))**

[![npm status](http://img.shields.io/npm/v/qool.svg?style=flat-square)](https://www.npmjs.org/package/qool) 

- durable
- strict FIFO ordering
- embeddable

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
- expiry for enqueued items
- dequeue ttl - items reappear in the queue if consumer did not confirm they were processed

[MIT](http://opensource.org/licenses/MIT) © yaniv kessler

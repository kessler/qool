# qool (WIP)

**a leveldb backed [Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))**

[![npm status](http://img.shields.io/npm/v/levelq.svg?style=flat-square)](https://www.npmjs.org/package/levelq) 

## Features
- strict FIFO ordering of enqueue and dequeue operations
- batching for level db mutating operations (del, put)

## license

### TODO
- enhance tests
- code is a little messy
- implement length property
- should we have a version of dequeue that "waits" if the queue is empty
- implement timeout on dequeue (item shows up on the queue again)

[MIT](http://opensource.org/licenses/MIT) © yaniv kessler

# levelq (WIP)

**Core queue backed by leveldb**

[![npm status](http://img.shields.io/npm/v/levelq.svg?style=flat-square)](https://www.npmjs.org/package/levelq) 

## Features
- strict ordering of enqueue and dequeue operations
- batching for level db mutating operations (del, put)

## license

### TODO
- unify batches - no need for distinction between enqueue and dequeue - it's all dels and puts 

[MIT](http://opensource.org/licenses/MIT) © yaniv kessler

# SmartBatch
An evolutions of UnifiedBatch.
Does not have a fixed length, size of the batch varies on the number of ops performed within a single event loop tick
Every batch first tries to fullfill all dequeues from the database with one read stream.
Remaining dequeues are fullfiled from memory (if there are any)

# UnifiedBatch
A more complex implementation but seems to be performing better when a mix of operations is performed on the queue (rather than one type)

~~In this scenario the batch size is fixed, and it includes both enqueue and dequeue operations. In order to make this work dequeue first runs on batched enqueues (which were not writting to the database yet!) before trying to dequeue from the actual database.~~

~~e.g: ```[enq(a), enq(b), deq(), deq(), deq()]```~~

~~The deq in index 2 will dequeue the value ```a```, the deq in index 3 will dequeue the value ```b``` and the deq in index 4 will try to fetch data from the actual database (in this case it will dequeue nothing)~~

This led to non fifo ordering, data from the databased should dequeue first before recent enqueues.

## Other optimizations

### initializing UnifiedBatch arrays to a predefined length

This yielded very small but noticeable improvement - but made the code far less readable

# Dequeue/Enqueue Batch
In this scenario each type of operation is included in it's own batch. The batches are processed serially. e.g 3 enqueus and 2 dequeues will created two batchs.

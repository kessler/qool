# SmartBatch

## enqueue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | 5,575ms | 2,130ms |
| 10 | 100,000 | 5,302ms | 1,959ms |
| 100 | 100,000 | 4,782ms | 1,704ms |
| 1,000 | 100,000 | 4,851ms | 1,781ms |
| 10,000 | 100,000 | 4,900ms | 1,890ms |
| 50,000 | 100,000 | 5,017ms | 2,621ms |
| 100,000 | 100,000 | 5,046ms | 3,567ms |

## dequeue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | n/a | n/a |
| 10 | 100,000 | n/a | n/a |
| 100 | 100,000 | 46,028ms | 19,271ms |
| 1,000 | 100,000 | 27,115ms | 13,491ms |
| 10,000 | 100,000 | 23,762ms | 13,066ms |
| 50,000 | 100,000 | 23,315ms | 17,669ms |
| 100,000 | 100,000 | 22,026ms | 21,953ms |


# UnifiedBatch
A more complex implementation but seems to be performing better when a mix of operations is performed on the queue (rather than one type)

In this scenario the batch size is fixed, and it includes both enqueue and dequeue operations. In order to make this work dequeue first runs on batched enqueues (which were not writting to the database yet!) before trying to dequeue from the actual database. 

e.g: ```[enq(a), enq(b), deq(), deq(), deq()]```

The deq in index 2 will dequeue the value ```a```, the deq in index 3 will dequeue the value ```b``` and the deq in index 4 will try to fetch data from the actual database (in this case it will dequeue nothing)

## enqueue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | 5,314ms | 1,990ms |
| 10 | 100,000 | 4,927ms | 1,791ms |
| 100 | 100,000 | 4,553ms | 1,581ms |
| 1,000 | 100,000 | 4,748ms | 1,716ms |
| 10,000 | 100,000 | 4,892ms | 1,791ms |
| 50,000 | 100,000 | 4,737ms | 2,543ms |
| 100,000 | 100,000 | 4,650ms | 3,214ms |

## dequeue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | n/a | n/a |
| 10 | 100,000 | n/a | n/a |
| 100 | 100,000 | 46,028ms | 19,271ms |
| 1,000 | 100,000 | 27,115ms | 13,491ms |
| 10,000 | 100,000 | 23,762ms | 13,066ms |
| 50,000 | 100,000 | 23,315ms | 17,669ms |
| 100,000 | 100,000 | 22,026ms | 21,953ms |

## mixed

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | n/a | n/a |
| 10 | 100,000 | 41,765ms | 12,855ms |
| 100 | 100,000 | 15,864ms | 7,374ms |
| 1,000 | 100,000 | 12,381ms | 6,453ms |
| 10,000 | 100,000 | 11,416ms | 6,388ms |
| 50,000 | 100,000 | 10,409ms | 7,444ms |
| 100,000 | 100,000 | 9,034ms | 8,955ms |

## Other optimizations

### initializing UnifiedBatch arrays to a predefined length

This yielded very small but noticeable improvement

#### enqueue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 1,000 | 100,000 | 4,555ms | 1,620ms |

#### dequeue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 1,000 | 100,000 | 25,081ms | 12,428ms |

#### mixed

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 1,000 | 100,000 | 11,760ms | 6,111ms |

# Dequeue/Enqueue Batch
In this scenario each type of operation is included in it's own batch. The batches are processed serially. e.g 3 enqueus and 2 dequeues will created two batchs.

## dequeue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | n/a | n/a |
| 10 | 100,000 | 209,261ms | 71,973ms |
| 100 | 100,000 | 43,074ms | 18,056ms |
| 1,000 | 100,000 | 25,199ms | 12,420ms |
| 10,000 | 100,000 | 23,599ms | 12,895ms |
| 100,000 | 100,000 | 23,373ms | 23,307ms |

## enqueue

| batch size | count | test time | avg to callback|
|-------------|---------|------------|------------------|
| 5 | 100,000 | n/a | n/a |
| 10 | 100,000 | 5,078ms | 1,868ms |
| 100 | 100,000 | 4,846ms | 1,697ms |
| 1,000 | 100,000 | 4,494ms | 1,575ms |
| 10,000 | 100,000 | 4,589ms | 1,699ms |
| 50,000 | 100,000 | 4,569ms | 2,434ms |
| 100,000 | 100,000 | 4,586ms | 3,166ms |

## mixed
Performed really BADLY


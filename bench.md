# OpsBatch

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

# Dequeue/Enqueue Batch

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
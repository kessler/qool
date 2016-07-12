| batch type | operation type | batch size | count | test time | avg to callback|
|--------------|-------------------|-------------|---------|------------|------------------|
| OpsBatch | enqueue | 10 | 100,000 | 4880ms | 1781ms |
| OpsBatch | enqueue | 100 | 100,000 | 4578ms | 1565ms |
| OpsBatch | enqueue | 1,000 | 100,000 | 4548ms | 1628ms |
| OpsBatch | enqueue | 10,000 | 100,000 | 4469ms | 1768ms |
| OpsBatch | enqueue | 50,000 | 100,000 | 4615ms | 2508ms |
| OpsBatch | enqueue | 100,000 | 100,000 | 4597ms | 3265ms |

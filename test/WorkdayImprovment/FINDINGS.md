# Workday Crawling Optimization Findings

## Current Performance
- **Globalhr**: 3,152 jobs in 73.75s (23ms/job)
- **Jci**: 2,510 jobs in 63.71s (25ms/job)
- **Average**: ~24ms per job

## API Constraints Discovered

### Hard Limit: 20 Jobs Per Request
Testing revealed that Workday's API **rejects any request with limit > 20**:

```
✅ limit=20  → 200 OK (20 jobs returned)
❌ limit=50  → 400 Bad Request
❌ limit=100 → 400 Bad Request  
❌ limit=200 → 400 Bad Request
```

This means:
- For 3,000 jobs, we need **150 requests minimum**
- Current approach makes these requests **sequentially**
- Batch size optimization is **not possible**

## Bottleneck Analysis

The main bottleneck is **network round-trip time**:

```
Time breakdown for 3,000 jobs:
- API requests: ~150 requests × 500ms = 75 seconds
- JSON parsing: negligible  
- Data processing: negligible
```

## Optimization Strategy: Parallel Requests

Since we can't increase batch size, the only way to speed up is **parallelism**:

### Approach 1: Fetch Total First, Then Parallelize
1. Make 1 request to get total count
2. Calculate number of pages needed (total / 20)
3. Fetch all pages in parallel batches

**Potential speedup**: 3-5x faster with 5-10 parallel requests

### Approach 2: Progressive Parallel Loading
1. Start with 5 parallel requests (offsets: 0, 20, 40, 60, 80)
2. As responses come back, queue more requests
3. Continue until all jobs fetched

**Benefits**: Better error handling, adaptive concurrency

### Risk Considerations

⚠️ **Rate Limiting**: Too many parallel requests might trigger rate limits  
⚠️ **Server Load**: Some Workday instances might throttle  
⚠️ **Connection Limits**: Browser/Node.js have max concurrent connections

**Recommended**: Start with 3-5 parallel requests, monitor for errors

## Implementation Plan

1. Test parallel approach with different concurrency levels (2, 3, 5, 10)
2. Add retry logic for failed requests
3. Add exponential backoff if rate limited
4. Monitor success rate vs. speed tradeoff
5. Choose optimal concurrency (likely 3-5 based on testing)

## Expected Results

With 5 parallel requests:
- Current: 150 requests × 500ms = 75s
- Parallel: 150 requests / 5 × 500ms = 15s
- **Speedup: 5x faster** (75s → 15s)

With error handling overhead, realistic expectation:
- **Target: 20-25 seconds for 3,000 jobs**
- **Speedup: 3x faster** than current

## Alternative Approaches (Not Viable)

❌ **HTML Scraping**: Workday pages are JS-rendered, would need headless browser (slower)  
❌ **GraphQL API**: Workday doesn't expose public GraphQL endpoints  
❌ **RSS/Sitemap**: Not consistently available across Workday instances  
❌ **Batch API**: No documented batch endpoint for job listings

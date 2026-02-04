# Video Hosting and Streaming Costs Research

**Sources**: api.video pricing, Dacast live streaming comparison, industry benchmarks  
**Date**: February 2026

## Video Hosting Cost Breakdown (api.video model)

| Component | Cost | Notes |
|-----------|------|-------|
| **Video Encoding** | FREE | Unlimited minutes, no hidden fees |
| **Video Hosting (Storage)** | $0.00285/minute | ~$0.17/hour stored |
| **Video Delivery (Bandwidth)** | $0.0017/minute | ~$0.10/hour delivered |
| **Transcription** | $0.10/minute | Optional, 33 languages |
| **Video Summarization** | $0.10/minute | Optional AI feature |

## Cost Calculations for BooGMe Use Cases

### Use Case 1: Live 1-on-1 Lessons (Primary Revenue Stream)

**Scenario**: 30 coaches × 20 lessons/month × 1 hour/lesson = 600 hours/month

**Option A: Use Zoom/Google Meet (Recommended for Year 1)**
- **Cost**: $0 (use free tier or coach's existing subscription)
- **Pros**: Zero platform cost, familiar interface, reliable
- **Cons**: No recording storage on platform, less control

**Option B: Self-hosted live streaming**
- **Encoding**: FREE
- **Delivery bandwidth**: 600 hours × 60 min × $0.0017 = **$61.20/month**
- **Storage (if recording)**: 600 hours × 60 min × $0.00285 = **$102.60/month**
- **Total**: **$163.80/month** for 600 hours of lessons

**Verdict**: Use Zoom/Google Meet integration for Year 1, migrate to self-hosted only if needed for specific features.

---

### Use Case 2: Content Library (PPV/Subscription Content)

**Scenario**: 30 coaches × 10 videos each × 15 minutes average = 4,500 minutes stored

**Monthly costs**:
- **Storage**: 4,500 min × $0.00285 = **$12.83/month**
- **Delivery**: Assume each video watched 5x/month = 22,500 min delivered
  - 22,500 min × $0.0017 = **$38.25/month**
- **Total**: **$51.08/month** for content library

**As library grows** (Year 2: 200 coaches × 20 videos × 15 min = 60,000 min):
- **Storage**: 60,000 × $0.00285 = **$171/month**
- **Delivery**: 300,000 min × $0.0017 = **$510/month**
- **Total**: **$681/month** for mature content library

---

### Use Case 3: Group Lessons (Subscription Feature)

**Scenario**: 10 coaches × 4 group sessions/month × 1 hour × 20 students watching = 800 hours delivered

**Monthly costs**:
- **Live streaming delivery**: 800 hours × 60 min × $0.0017 = **$81.60/month**
- **Recording storage**: 40 hours × 60 min × $0.00285 = **$6.84/month**
- **Total**: **$88.44/month** for group lessons

---

## Total Video Infrastructure Costs by Phase

### Phase 1 (Months 1-6): Lessons Only
- **Live lessons**: $0 (use Zoom/Google Meet)
- **Total**: **$0/month**

### Phase 2 (Months 7-12): Add Content Library
- **Live lessons**: $0 (still using Zoom)
- **Content library**: $51/month (4,500 min stored, 22,500 min delivered)
- **Total**: **$51/month**

### Phase 3 (Year 2): Full Platform with Group Lessons
- **Live 1-on-1**: $0 (Zoom) OR $164/month (self-hosted)
- **Content library**: $681/month (60,000 min stored, 300,000 min delivered)
- **Group lessons**: $88/month (800 hours delivered)
- **Total**: **$769-933/month** depending on 1-on-1 hosting choice

---

## Hidden Costs to Watch For

### 1. Bandwidth Overage
- Video streaming is **bandwidth-intensive**
- 1 hour of 1080p video ≈ 3-7 GB of data
- At $0.10/GB (CDN pricing), 1 hour delivered = $0.30-0.70
- **Mitigation**: Use adaptive bitrate streaming, compress videos, cache popular content

### 2. Storage Growth
- Recorded lessons accumulate quickly
- 1 hour of 1080p video ≈ 2-4 GB storage
- At $0.023/GB/month (AWS S3 pricing), 1 hour = $0.046-0.092/month
- **Mitigation**: Delete old recordings after 90 days, offer download option to students

### 3. Transcoding Costs
- Converting videos to multiple resolutions/formats
- Can add $0.01-0.05 per minute
- **Mitigation**: Use platforms with free encoding (like api.video)

### 4. Live Streaming Latency
- Low-latency streaming (< 3 seconds) costs 2-3x more than standard
- **BooGMe decision**: Standard latency (5-10 seconds) is fine for lessons

---

## Comparison: Build vs Buy

### Option A: Use Zoom + Vimeo/YouTube for Content
- **Zoom Pro**: $13.33/user/month × 30 coaches = $400/month
- **Vimeo Plus**: $20/month for content hosting
- **Total**: **$420/month**
- **Pros**: Reliable, familiar, zero dev time
- **Cons**: Less control, coaches might use personal Zoom accounts anyway

### Option B: Integrate Zoom + Self-host Content Library
- **Zoom**: $0 (coaches use own accounts or free tier)
- **Video hosting**: $51-681/month (scales with usage)
- **Total**: **$51-681/month**
- **Pros**: Full control, scales efficiently, better margins
- **Cons**: Requires development time

### Option C: Fully Self-hosted (Agora.io, Daily.co)
- **Agora.io**: $0.99/1,000 minutes for video calls
  - 600 hours/month = 36,000 minutes = **$35.64/month**
- **Content hosting**: $51-681/month
- **Total**: **$87-717/month**
- **Pros**: Full control, white-label, best UX
- **Cons**: Higher dev complexity, reliability risk

---

## Recommended Strategy for BooGMe

### Year 1 (Months 1-12):
1. **Live lessons**: Integrate Zoom/Google Meet (coaches use own accounts)
   - **Cost**: $0/month
   - **Why**: Proven reliability, zero infrastructure risk, faster launch

2. **Content library**: Self-host with api.video or similar
   - **Cost**: $51/month initially, scales to $200-300/month by Month 12
   - **Why**: Full control over monetization, better margins on PPV content

3. **Group lessons**: Use Zoom webinar feature initially
   - **Cost**: Included in coaches' Zoom accounts
   - **Why**: Defer complexity until proven demand

### Year 2 (Months 13-24):
1. **Migrate to self-hosted live lessons** if:
   - Need custom features (PGN integration, chess board overlay)
   - Want to reduce coach friction (no separate Zoom account needed)
   - Have engineering resources to maintain reliability

2. **Scale content library** with CDN optimization
   - **Cost**: $500-800/month at 200 coaches
   - **Revenue**: $126K/month from subscriptions (from earlier projections)
   - **Margin**: 99.4% gross margin on content revenue

---

## Key Takeaway

**Video infrastructure is NOT the expensive part** of BooGMe. At scale (Year 2):
- Video costs: **$700-900/month**
- Platform revenue: **$399K/month**
- Video costs as % of revenue: **0.2%**

The real costs are:
1. **Payroll** (67% of costs in industry benchmark)
2. **Customer acquisition** (19% of costs)
3. **Payment processing** (2.9% of every transaction)

**Recommendation**: Don't over-engineer video infrastructure in Year 1. Use Zoom integration, focus on coach/student acquisition, and migrate to self-hosted video only when you have proven demand and engineering resources.

# Payment Processing and Chess-Specific Tool Costs Research

**Sources**: Stripe Connect pricing, Lichess infrastructure costs, industry benchmarks  
**Date**: February 2026

## Stripe Connect Marketplace Pricing

### Two Pricing Models:

#### Model 1: "Stripe handles pricing for your users"
- **Platform cost**: $0 (Stripe bills connected accounts directly)
- **Monetization**: Revenue share from Stripe (must qualify)
- **Use case**: Platforms that want Stripe to handle all billing
- **BooGMe fit**: ❌ Not suitable—we want control over pricing and margins

#### Model 2: "You handle pricing for your users" (RECOMMENDED)
- **Active account fee**: $2/month per coach who receives payouts
- **Payout fee**: 0.25% + $0.25 per payout
- **Use case**: Marketplaces that want to deploy their own pricing strategy
- **BooGMe fit**: ✅ Perfect—we control commission rates and can adjust dynamically

### Stripe Connect Cost Breakdown for BooGMe:

| Component | Cost Formula | Example (30 coaches, $75K GMV/month) |
|-----------|-------------|--------------------------------------|
| **Base transaction fee** | 2.9% + $0.30 per transaction | $2,175 + $300 = $2,475 |
| **Active account fee** | $2/month per coach receiving payouts | 30 coaches × $2 = $60 |
| **Payout fee** | 0.25% + $0.25 per payout | $187.50 + $7.50 = $195 |
| **TOTAL STRIPE COSTS** | - | **$2,730/month** |
| **% of GMV** | - | **3.64%** |

### Key Insights:

1. **Base transaction fee (2.9% + $0.30) is unavoidable**
   - This is what Stripe charges for payment processing
   - Applies to every credit card transaction
   - **Cannot be avoided** unless using ACH/bank transfers (which have UX friction)

2. **Active account fee ($2/coach/month) is minimal**
   - 30 coaches = $60/month
   - 200 coaches = $400/month
   - **Negligible compared to transaction fees**

3. **Payout fee (0.25% + $0.25) is also minimal**
   - On $75K GMV, only $195/month
   - **0.26% of GMV**—almost nothing

4. **Total Stripe cost ≈ 3.6-3.8% of GMV**
   - If BooGMe charges 15% commission, net after Stripe = **11.2-11.4%**
   - If BooGMe charges 8% commission (Professional tier), net = **4.2-4.4%**
   - If BooGMe charges 2% commission (Elite tier), net = **NEGATIVE 1.6%** ❌

### Critical Realization: Elite Tier (2% commission) is UNPROFITABLE

**Problem**: Stripe takes 3.6%, but Elite tier only charges 2% commission

**Solutions**:
1. **Charge coaches the Stripe fee separately** (2.9% + $0.30 + 2% commission = 4.9% total)
2. **Increase Elite tier commission to 5%** (net 1.4% after Stripe)
3. **Make Elite tier a monthly subscription only** ($149/month, 0% commission, coaches pay Stripe directly)

**Recommendation**: Option 3—Elite tier is **$149/month subscription with 0% commission**. Coaches pay Stripe fees directly (2.9% + $0.30), BooGMe gets predictable MRR, coaches still save money at scale.

---

## Revised Commission Structure (Accounting for Stripe Fees)

| Tier | Monthly Fee | Commission | Stripe Fees | Net to BooGMe | Break-even GMV |
|------|------------|-----------|-------------|---------------|----------------|
| **Starter** | $0 | 15% | 3.6% | 11.4% | N/A |
| **Professional** | $49 | 8% | 3.6% | 4.4% | $1,114/month |
| **Elite** | $149 | 0% | Paid by coach | $149/month | N/A |

**Professional tier break-even**: $49 / 4.4% = $1,114 GMV/month
- A coach doing 10 lessons/month × $100 = $1,000 GMV → **Starter tier is better**
- A coach doing 15 lessons/month × $100 = $1,500 GMV → **Professional tier saves $18/month**
- A coach doing 30 lessons/month × $100 = $3,000 GMV → **Professional tier saves $99/month**

**Elite tier break-even**: $149 / 11.4% = $1,307 GMV/month
- A coach doing 40 lessons/month × $100 = $4,000 GMV → **Elite tier saves $307/month**
- A coach doing 100 lessons/month × $100 = $10,000 GMV → **Elite tier saves $991/month**

---

## Chess-Specific Tool Costs

### 1. Stockfish Chess Engine
- **Cost**: FREE (open source)
- **Hosting**: Run on own servers or use Lichess cloud evaluations API
- **Lichess API**: FREE for 15 million positions
- **Use case**: Game analysis, position evaluation, opening suggestions

### 2. Lichess Infrastructure Costs (Reference)
- **Total annual cost**: ~$400K/year to run Lichess.org
- **Breakdown**:
  - Server hosting: ~$200K/year
  - Stockfish instances: ~$100K/year
  - Bandwidth: ~$50K/year
  - Staff/maintenance: ~$50K/year
- **Scale**: 150K+ concurrent users, millions of games/day
- **BooGMe scale**: 1/1000th of Lichess traffic → ~$400/year for chess engine hosting

### 3. Chess Database (Opening Books, Game Archives)
- **Cost**: FREE (use Lichess open database or chess.com public games)
- **Storage**: ~10 GB for comprehensive opening book → $0.23/month (AWS S3)
- **Use case**: Opening preparation, game analysis, training materials

### 4. PGN Processing and Board Rendering
- **Cost**: FREE (open source libraries)
- **Libraries**: chess.js (JavaScript), python-chess (Python)
- **Use case**: Display chess boards, parse PGN files, validate moves

### 5. Live Board Integration (for lessons)
- **Option A**: Use Lichess board editor (FREE, embed via iframe)
- **Option B**: Use chessboard.js + chess.js (FREE, self-hosted)
- **Option C**: Use Chess.com board API (FREE for non-commercial, may require license for commercial)
- **Recommendation**: Option B—full control, no licensing issues

### Total Chess-Specific Tool Costs: **~$50/month** at scale
- Chess engine hosting: $33/month
- Database storage: $10/month
- Board rendering: $0 (open source)
- PGN processing: $0 (open source)
- Misc tools/APIs: $7/month

---

## Hidden Cost: Customer Acquisition (CAC)

**Industry benchmark** (from infrastructure research):
- **Buyer CAC**: $100
- **Seller CAC**: $250
- **Monthly budget**: $10,833 for 30 sellers + 600 buyers

**BooGMe advantage**: Leverage C-Squared audience
- **Organic coach acquisition**: $0-50 per coach (vs $250 industry standard)
- **Student acquisition**: $30-50 per student (vs $100 industry standard)
- **Year 1 budget**: $3,000/month (vs $10,833 industry)

**Calculation**:
- Acquire 5 coaches/month × $50 = $250
- Acquire 100 students/month × $30 = $3,000
- **Total CAC**: $3,250/month in Year 1

**Year 2 scaling**:
- Acquire 15 coaches/month × $75 = $1,125 (higher quality, more competitive)
- Acquire 450 students/month × $40 = $18,000 (paid ads, broader targeting)
- **Total CAC**: $19,125/month in Year 2

---

## Summary: Total Variable Costs by GMV

| GMV/Month | Stripe Fees (3.6%) | Chess Tools | Video Hosting | CAC (Year 1) | Total Variable Costs | % of GMV |
|-----------|-------------------|-------------|---------------|--------------|---------------------|----------|
| $25,000 | $900 | $50 | $0 | $3,250 | $4,200 | 16.8% |
| $75,000 | $2,700 | $50 | $51 | $3,250 | $6,051 | 8.1% |
| $150,000 | $5,400 | $50 | $200 | $3,250 | $8,900 | 5.9% |
| $500,000 | $18,000 | $50 | $700 | $19,125 | $37,875 | 7.6% |

**Key insight**: Stripe fees dominate variable costs. Chess tools and video hosting are negligible.

---

## Critical Takeaway: Payment Processing is the Hidden Cost

**What eats your margin**:
1. **Stripe fees**: 3.6% of GMV (unavoidable)
2. **Customer acquisition**: 8-16% of GMV in Year 1, decreases to 4-8% in Year 2
3. **Everything else**: < 1% of GMV

**Implication for commission structure**:
- **Minimum viable commission**: 5% (to cover Stripe + have 1.4% margin)
- **Sustainable commission**: 10-15% (to cover Stripe + CAC + operations)
- **Elite tier must be subscription-only**: Can't charge 2% commission when Stripe takes 3.6%

**Revised recommendation**:
- **Starter**: Free, 15% commission (11.4% net after Stripe)
- **Professional**: $49/month, 10% commission (6.4% net after Stripe)
- **Elite**: $149/month, 5% commission (1.4% net after Stripe)

This keeps all tiers profitable while still offering significant savings for high-volume coaches.

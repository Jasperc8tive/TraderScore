-- TradeScore representative-scale DB benchmark.
-- Bulk-loads ~10k businesses + ~100k CONFIRMED trades + score snapshots, then
-- EXPLAIN ANALYZEs the hot query paths. Full-scale (100k/10M) load testing belongs
-- on staging hardware; this proves index usage and query shape at representative scale.
\timing on

-- One owner user for all benchmark businesses (FK satisfied; volume is on businesses/trades).
WITH u AS (
  INSERT INTO users (phone, role, status)
  VALUES ('bench-owner', 'BUSINESS_OWNER', 'ACTIVE')
  ON CONFLICT (phone) WHERE deleted_at IS NULL DO UPDATE SET status = 'ACTIVE'
  RETURNING id
)
INSERT INTO businesses (name, slug, assurance_level, status, created_by, referral_code)
SELECT 'Bench Biz ' || g, 'bench-biz-' || g, 'UNVERIFIED', 'ACTIVE',
       (SELECT id FROM u), 'BENCH' || lpad(g::text, 6, '0')
FROM generate_series(1, 10000) g
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;

CREATE TEMP TABLE bench_biz AS
SELECT row_number() OVER (ORDER BY slug) AS n, id FROM businesses WHERE slug LIKE 'bench-biz-%';

INSERT INTO trades (reference_code, initiator_business_id, counterparty_business_id,
                    direction, amount_minor, currency, occurred_on, status, created_by)
SELECT 'BENCHT' || g, b1.id, b2.id, 'SALE', 100000, 'NGN', current_date, 'CONFIRMED',
       (SELECT id FROM users WHERE phone = 'bench-owner')
FROM generate_series(1, 100000) g
JOIN bench_biz b1 ON b1.n = (g % 10000) + 1
JOIN bench_biz b2 ON b2.n = ((g * 7 + 3) % 10000) + 1
WHERE b1.id <> b2.id
ON CONFLICT (reference_code) WHERE deleted_at IS NULL DO NOTHING;

INSERT INTO score_snapshots (business_id, algorithm_version, score, band, inputs_hash)
SELECT id, '1.0.0', 300, 'ESTABLISHED', 'bench' FROM bench_biz;

ANALYZE businesses; ANALYZE trades; ANALYZE score_snapshots;

SELECT 'rows: businesses=' || (SELECT count(*) FROM businesses) ||
       ', trades=' || (SELECT count(*) FROM trades) ||
       ', snapshots=' || (SELECT count(*) FROM score_snapshots) AS dataset;

\echo '== Q1 discovery search (name + latest score lateral join) =='
EXPLAIN ANALYZE
SELECT b.id, b.name, s.score, s.band, sub.plan AS active_plan
FROM businesses b
LEFT JOIN market_clusters mc ON mc.id = b.market_cluster_id AND mc.deleted_at IS NULL
LEFT JOIN subscriptions sub ON sub.business_id = b.id AND sub.status = 'ACTIVE'
LEFT JOIN LATERAL (
  SELECT score, band FROM score_snapshots ss WHERE ss.business_id = b.id ORDER BY ss.computed_at DESC LIMIT 1
) s ON true
WHERE b.deleted_at IS NULL AND b.status = 'ACTIVE' AND b.name ILIKE '%Bench Biz 5000%'
ORDER BY s.score DESC NULLS LAST, b.name ASC LIMIT 20;

\echo '== Q2 latest score snapshot for one business =='
EXPLAIN ANALYZE
SELECT score, band FROM score_snapshots
WHERE business_id = (SELECT id FROM bench_biz LIMIT 1)
ORDER BY computed_at DESC LIMIT 1;

\echo '== Q3 fraud: distinct confirmed edges (graph scan) =='
EXPLAIN ANALYZE
SELECT DISTINCT initiator_business_id, counterparty_business_id
FROM trades
WHERE status = 'CONFIRMED' AND deleted_at IS NULL AND counterparty_business_id IS NOT NULL;

\echo '== Q4 trades list for one business =='
EXPLAIN ANALYZE
SELECT * FROM trades
WHERE deleted_at IS NULL AND initiator_business_id = (SELECT id FROM bench_biz LIMIT 1)
ORDER BY occurred_on DESC, created_at DESC LIMIT 20;

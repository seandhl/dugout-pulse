-- psql -v batch_id=... -v season_id=... -v score_version_id=... -f scripts/explain-public-ranking.sql
-- Read-only plan. Supply a previously authorized, DEMO batch; no external acquisition.
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT player_id, value, delta
FROM "MomentumSnapshot"
WHERE batch_id = :'batch_id' AND season_id = :'season_id'
  AND competition = 'REGULAR' AND evaluation_role = 'BATTER'
  AND window = 10 AND score_version_id = :'score_version_id'
  AND status = 'READY' AND value IS NOT NULL
ORDER BY value DESC NULLS FIRST, player_id ASC
LIMIT 20;

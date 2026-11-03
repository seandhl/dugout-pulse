-- Scope a page to a single authorized publication; deterministic player tie break.
CREATE INDEX "momentum_public_page" ON "MomentumSnapshot"
("batch_id", "season_id", "competition", "evaluation_role", "window", "score_version_id", "value" DESC, "player_id" ASC);

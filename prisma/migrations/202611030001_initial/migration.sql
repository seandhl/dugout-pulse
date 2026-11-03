-- Initial snapshot schema. Cyclic batch dimension FKs are deferred.
BEGIN;
CREATE TYPE "DataMode" AS ENUM ('DEMO', 'APPROVED');
CREATE TYPE "CompetitionKind" AS ENUM ('REGULAR', 'POSTSEASON');
CREATE TYPE "PlayerRole" AS ENUM ('BATTER', 'STARTER', 'RELIEVER');
CREATE TYPE "LicenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "BatchStatus" AS ENUM ('STAGED', 'VALIDATED', 'REJECTED');
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'SUSPENDED', 'FINAL', 'CANCELLED', 'VOID');
CREATE TYPE "RosterStatus" AS ENUM ('REGISTERED', 'UNREGISTERED', 'UNKNOWN');
CREATE TYPE "HistoryEvidence" AS ENUM ('ROSTER', 'GAME', 'VERIFIED_INPUT');
CREATE TYPE "ModelStatus" AS ENUM ('PROPOSED', 'ADOPTED', 'RETIRED');
CREATE TYPE "ScoreStatus" AS ENUM ('READY', 'INSUFFICIENT_SAMPLE', 'MISSING_DATA', 'NO_APPEARANCES');
CREATE TABLE "DataSource" (
  "source_id" TEXT NOT NULL PRIMARY KEY,
  "public_name" VARCHAR(200) NOT NULL,
  "current_status" "LicenseStatus" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "DataLicense" (
  "rights_record_id" TEXT NOT NULL PRIMARY KEY,
  "source_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "public_name" VARCHAR(200) NOT NULL,
  "attribution" VARCHAR(1000) NOT NULL,
  "public_url" VARCHAR(2048),
  "mode" "DataMode" NOT NULL,
  "status" "LicenseStatus" NOT NULL,
  "collection" BOOLEAN NOT NULL,
  "storage" BOOLEAN NOT NULL,
  "derivation" BOOLEAN NOT NULL,
  "publication" BOOLEAN NOT NULL,
  "allowed_fields" TEXT[] NOT NULL,
  "allowed_seasons" TEXT[] NOT NULL,
  "allowed_competitions" TEXT[] NOT NULL,
  "effective_at" TIMESTAMPTZ(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "evidence_ref" TEXT NOT NULL,
  "review_ref" TEXT NOT NULL,
  UNIQUE ("source_id", "version"),
  UNIQUE ("rights_record_id", "source_id", "mode")
);
-- index ImportBatch ("season_id", "competition")
CREATE TABLE "ImportBatch" (
  "batch_id" TEXT NOT NULL PRIMARY KEY,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "season_id" TEXT NOT NULL,
  "competition_id" TEXT NOT NULL,
  "competition" "CompetitionKind" NOT NULL,
  "schema_version" TEXT NOT NULL DEFAULT '1.0.0',
  "mode" "DataMode" NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "imported_at" TIMESTAMPTZ(3) NOT NULL,
  "last_successful_sync_at" TIMESTAMPTZ(3),
  "raw_hash" CHAR(64) NOT NULL,
  "canonical_hash" CHAR(64) NOT NULL,
  "adapter_version" VARCHAR(64) NOT NULL,
  "status" "BatchStatus" NOT NULL,
  "validation_report_ref" TEXT,
  UNIQUE ("batch_id", "source_id", "rights_record_id"),
  UNIQUE ("batch_id", "season_id", "competition_id", "competition"),
  UNIQUE ("source_id", "mode", "season_id", "competition_id", "schema_version", "canonical_hash")
);
CREATE INDEX "ImportBatch_season_id_competition_idx" ON "ImportBatch" ("season_id", "competition");
CREATE TABLE "Season" (
  "season_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "year" INTEGER NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  PRIMARY KEY ("batch_id", "season_id"),
  UNIQUE ("batch_id"),
  UNIQUE ("batch_id", "year")
);
CREATE TABLE "Competition" (
  "competition_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "kind" "CompetitionKind" NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  PRIMARY KEY ("batch_id", "competition_id"),
  UNIQUE ("batch_id"),
  UNIQUE ("batch_id", "competition_id", "kind")
);
CREATE TABLE "Team" (
  "team_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "name" VARCHAR(100) NOT NULL,
  "short_name" VARCHAR(20) NOT NULL,
  PRIMARY KEY ("batch_id", "team_id")
);
CREATE TABLE "PlayerIdentity" (
  "player_id" TEXT NOT NULL PRIMARY KEY
);
-- index Player ("display_name", "player_id")
CREATE TABLE "Player" (
  "player_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "display_name" VARCHAR(100) NOT NULL,
  "listed_roles" "PlayerRole"[] NOT NULL,
  PRIMARY KEY ("batch_id", "player_id")
);
CREATE INDEX "Player_display_name_player_id_idx" ON "Player" ("display_name", "player_id");
-- index PlayerSourceIdentity ("player_id")
CREATE TABLE "PlayerSourceIdentity" (
  "source_id" TEXT NOT NULL,
  "external_player_id" VARCHAR(200) NOT NULL,
  "player_id" TEXT NOT NULL,
  "verified_at" TIMESTAMPTZ(3) NOT NULL,
  "audit_event_id" TEXT NOT NULL,
  PRIMARY KEY ("source_id", "external_player_id")
);
CREATE INDEX "PlayerSourceIdentity_player_id_idx" ON "PlayerSourceIdentity" ("player_id");
-- index Game ("batch_id", "original_date")
-- index Game ("season_id", "competition", "completed_at")
CREATE TABLE "Game" (
  "game_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "season_id" TEXT NOT NULL,
  "competition_id" TEXT NOT NULL,
  "competition" "CompetitionKind" NOT NULL,
  "home_team_id" TEXT NOT NULL,
  "away_team_id" TEXT NOT NULL,
  "original_date" DATE NOT NULL,
  "played_on" DATE,
  "scheduled_at_kst" TIMESTAMPTZ(3),
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "doubleheader_no" INTEGER NOT NULL,
  "status" "GameStatus" NOT NULL,
  "record_revision" INTEGER NOT NULL,
  "supersedes_batch_id" TEXT,
  "corrected_at" TIMESTAMPTZ(3),
  PRIMARY KEY ("batch_id", "game_id")
);
CREATE INDEX "Game_batch_id_original_date_idx" ON "Game" ("batch_id", "original_date");
CREATE INDEX "Game_season_id_competition_completed_at_idx" ON "Game" ("season_id", "competition", "completed_at");
-- index BattingGameLog ("batch_id", "player_id", "role", "game_id")
CREATE TABLE "BattingGameLog" (
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "game_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "role" "PlayerRole" NOT NULL,
  "external_game_id" VARCHAR(200) NOT NULL,
  "external_player_id" VARCHAR(200) NOT NULL,
  "external_appearance_id" VARCHAR(200) NOT NULL,
  "pa" INTEGER,
  "ab" INTEGER,
  "h" INTEGER,
  "doubles" INTEGER,
  "triples" INTEGER,
  "hr" INTEGER,
  "bb" INTEGER,
  "hbp" INTEGER,
  "ibb" INTEGER,
  "so" INTEGER,
  "sf" INTEGER,
  "sac" INTEGER,
  "r" INTEGER,
  "rbi" INTEGER,
  "sb" INTEGER,
  "cs" INTEGER,
  "tb" INTEGER,
  PRIMARY KEY ("batch_id", "game_id", "player_id"),
  UNIQUE ("batch_id", "source_id", "external_game_id", "external_player_id", "external_appearance_id", "role")
);
CREATE INDEX "BattingGameLog_batch_id_player_id_role_game_id_idx" ON "BattingGameLog" ("batch_id", "player_id", "role", "game_id");
-- index PitchingGameLog ("batch_id", "player_id", "role", "game_id")
CREATE TABLE "PitchingGameLog" (
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "game_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "role" "PlayerRole" NOT NULL,
  "external_game_id" VARCHAR(200) NOT NULL,
  "external_player_id" VARCHAR(200) NOT NULL,
  "external_appearance_id" VARCHAR(200) NOT NULL,
  "bf" INTEGER,
  "outs_recorded" INTEGER,
  "h" INTEGER,
  "er" INTEGER,
  "r" INTEGER,
  "bb" INTEGER,
  "ibb" INTEGER,
  "hbp" INTEGER,
  "so" INTEGER,
  "hr" INTEGER,
  "np" INTEGER,
  "sv" INTEGER,
  "hld" INTEGER,
  "gs" INTEGER NOT NULL,
  PRIMARY KEY ("batch_id", "game_id", "player_id"),
  UNIQUE ("batch_id", "source_id", "external_game_id", "external_player_id", "external_appearance_id", "role")
);
CREATE INDEX "PitchingGameLog_batch_id_player_id_role_game_id_idx" ON "PitchingGameLog" ("batch_id", "player_id", "role", "game_id");
CREATE TABLE "RosterSnapshot" (
  "snapshot_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "snapshot_on" DATE NOT NULL,
  PRIMARY KEY ("batch_id", "snapshot_id"),
  UNIQUE ("batch_id", "snapshot_on")
);
-- index RosterMember ("batch_id", "player_id", "snapshot_on")
CREATE TABLE "RosterMember" (
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "snapshot_id" TEXT NOT NULL,
  "snapshot_on" DATE NOT NULL,
  "player_id" TEXT NOT NULL,
  "team_id" TEXT,
  "effective_on" DATE,
  "status" "RosterStatus" NOT NULL,
  "uniform_number" VARCHAR(8),
  PRIMARY KEY ("batch_id", "snapshot_on", "player_id")
);
CREATE INDEX "RosterMember_batch_id_player_id_snapshot_on_idx" ON "RosterMember" ("batch_id", "player_id", "snapshot_on");
-- index PlayerTeamHistory ("batch_id", "player_id", "observed_on")
CREATE TABLE "PlayerTeamHistory" (
  "history_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "player_id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "observed_on" DATE NOT NULL,
  "effective_on" DATE,
  "evidence_kind" "HistoryEvidence" NOT NULL,
  PRIMARY KEY ("batch_id", "history_id")
);
CREATE INDEX "PlayerTeamHistory_batch_id_player_id_observed_on_idx" ON "PlayerTeamHistory" ("batch_id", "player_id", "observed_on");
CREATE TABLE "ScoringModelVersion" (
  "score_version_id" TEXT NOT NULL PRIMARY KEY,
  "version" VARCHAR(64) NOT NULL UNIQUE,
  "status" "ModelStatus" NOT NULL,
  "roles" JSONB NOT NULL,
  "adopted_at" TIMESTAMPTZ(3)
);
-- index MomentumSnapshot ("season_id", "competition", "evaluation_role", "window", "score_version_id", "value")
CREATE TABLE "MomentumSnapshot" (
  "score_snapshot_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "rights_record_id" TEXT NOT NULL,
  "as_of" TIMESTAMPTZ(3) NOT NULL,
  "source_record_key" VARCHAR(200) NOT NULL,
  "missing_fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "season_id" TEXT NOT NULL,
  "competition_id" TEXT NOT NULL,
  "competition" "CompetitionKind" NOT NULL,
  "player_id" TEXT NOT NULL,
  "score_version_id" TEXT NOT NULL,
  "evaluation_role" "PlayerRole" NOT NULL,
  "team_scope" TEXT NOT NULL,
  "window" INTEGER NOT NULL,
  "as_of_game_id" TEXT NOT NULL,
  "cutoff_at" TIMESTAMPTZ(3) NOT NULL,
  "status" "ScoreStatus" NOT NULL,
  "value" DECIMAL(30,15),
  "previous_value" DECIMAL(30,15),
  "delta" DECIMAL(30,15),
  "sample" JSONB NOT NULL,
  "input_refs" JSONB NOT NULL,
  "computed_at" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("batch_id", "score_snapshot_id"),
  UNIQUE ("batch_id", "score_version_id", "player_id", "evaluation_role", "team_scope", "cutoff_at"),
  UNIQUE ("batch_id", "season_id", "competition", "player_id", "evaluation_role", "window", "as_of_game_id", "score_version_id", "team_scope")
);
CREATE INDEX "MomentumSnapshot_season_id_competition_evaluation_role_window_s" ON "MomentumSnapshot" ("season_id", "competition", "evaluation_role", "window", "score_version_id", "value");
-- index ImportRowIssue ("batch_id", "row_number")
CREATE TABLE "ImportRowIssue" (
  "issue_id" TEXT NOT NULL PRIMARY KEY,
  "batch_id" TEXT NOT NULL,
  "row_number" INTEGER,
  "entity" VARCHAR(100) NOT NULL,
  "source_record_key" VARCHAR(200),
  "field" VARCHAR(100),
  "code" VARCHAR(100) NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ImportRowIssue_batch_id_row_number_idx" ON "ImportRowIssue" ("batch_id", "row_number");
-- index AuditEvent ("batch_id", "occurred_at")
CREATE TABLE "AuditEvent" (
  "audit_event_id" TEXT NOT NULL PRIMARY KEY,
  "batch_id" TEXT,
  "source_id" TEXT,
  "rights_record_id" TEXT,
  "action" VARCHAR(100) NOT NULL,
  "actor_ref" VARCHAR(200) NOT NULL,
  "entity_ref" VARCHAR(200) NOT NULL,
  "metadata" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditEvent_batch_id_occurred_at_idx" ON "AuditEvent" ("batch_id", "occurred_at");
ALTER TABLE "DataLicense" ADD CONSTRAINT "fk_0" FOREIGN KEY ("source_id") REFERENCES "DataSource" ("source_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "fk_1" FOREIGN KEY ("rights_record_id", "source_id", "mode") REFERENCES "DataLicense" ("rights_record_id", "source_id", "mode") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Season" ADD CONSTRAINT "fk_2" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Competition" ADD CONSTRAINT "fk_3" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "fk_4" FOREIGN KEY ("batch_id", "season_id") REFERENCES "Season" ("batch_id", "season_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "fk_5" FOREIGN KEY ("batch_id", "competition_id", "competition") REFERENCES "Competition" ("batch_id", "competition_id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Team" ADD CONSTRAINT "fk_6" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Player" ADD CONSTRAINT "fk_7" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Player" ADD CONSTRAINT "fk_8" FOREIGN KEY ("player_id") REFERENCES "PlayerIdentity" ("player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PlayerSourceIdentity" ADD CONSTRAINT "fk_9" FOREIGN KEY ("source_id") REFERENCES "DataSource" ("source_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PlayerSourceIdentity" ADD CONSTRAINT "fk_10" FOREIGN KEY ("player_id") REFERENCES "PlayerIdentity" ("player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Game" ADD CONSTRAINT "fk_11" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Game" ADD CONSTRAINT "fk_12" FOREIGN KEY ("batch_id", "season_id", "competition_id", "competition") REFERENCES "ImportBatch" ("batch_id", "season_id", "competition_id", "competition") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Game" ADD CONSTRAINT "fk_13" FOREIGN KEY ("batch_id", "home_team_id") REFERENCES "Team" ("batch_id", "team_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Game" ADD CONSTRAINT "fk_14" FOREIGN KEY ("batch_id", "away_team_id") REFERENCES "Team" ("batch_id", "team_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Game" ADD CONSTRAINT "fk_15" FOREIGN KEY ("supersedes_batch_id") REFERENCES "ImportBatch" ("batch_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "fk_16" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "fk_17" FOREIGN KEY ("batch_id", "game_id") REFERENCES "Game" ("batch_id", "game_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "fk_18" FOREIGN KEY ("batch_id", "player_id") REFERENCES "Player" ("batch_id", "player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "fk_19" FOREIGN KEY ("batch_id", "team_id") REFERENCES "Team" ("batch_id", "team_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "fk_20" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "fk_21" FOREIGN KEY ("batch_id", "game_id") REFERENCES "Game" ("batch_id", "game_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "fk_22" FOREIGN KEY ("batch_id", "player_id") REFERENCES "Player" ("batch_id", "player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "fk_23" FOREIGN KEY ("batch_id", "team_id") REFERENCES "Team" ("batch_id", "team_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RosterSnapshot" ADD CONSTRAINT "fk_24" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RosterMember" ADD CONSTRAINT "fk_25" FOREIGN KEY ("batch_id", "snapshot_id") REFERENCES "RosterSnapshot" ("batch_id", "snapshot_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RosterMember" ADD CONSTRAINT "fk_26" FOREIGN KEY ("batch_id", "player_id") REFERENCES "Player" ("batch_id", "player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RosterMember" ADD CONSTRAINT "fk_27" FOREIGN KEY ("batch_id", "team_id") REFERENCES "Team" ("batch_id", "team_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "RosterMember" ADD CONSTRAINT "fk_28" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PlayerTeamHistory" ADD CONSTRAINT "fk_29" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PlayerTeamHistory" ADD CONSTRAINT "fk_30" FOREIGN KEY ("batch_id", "player_id") REFERENCES "Player" ("batch_id", "player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PlayerTeamHistory" ADD CONSTRAINT "fk_31" FOREIGN KEY ("batch_id", "team_id") REFERENCES "Team" ("batch_id", "team_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "fk_32" FOREIGN KEY ("batch_id", "source_id", "rights_record_id") REFERENCES "ImportBatch" ("batch_id", "source_id", "rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "fk_33" FOREIGN KEY ("batch_id", "season_id", "competition_id", "competition") REFERENCES "ImportBatch" ("batch_id", "season_id", "competition_id", "competition") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "fk_34" FOREIGN KEY ("batch_id", "player_id") REFERENCES "Player" ("batch_id", "player_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "fk_35" FOREIGN KEY ("batch_id", "as_of_game_id") REFERENCES "Game" ("batch_id", "game_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "fk_36" FOREIGN KEY ("score_version_id") REFERENCES "ScoringModelVersion" ("score_version_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ImportRowIssue" ADD CONSTRAINT "fk_37" FOREIGN KEY ("batch_id") REFERENCES "ImportBatch" ("batch_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "fk_38" FOREIGN KEY ("batch_id") REFERENCES "ImportBatch" ("batch_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "fk_39" FOREIGN KEY ("source_id") REFERENCES "DataSource" ("source_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "fk_40" FOREIGN KEY ("rights_record_id") REFERENCES "DataLicense" ("rights_record_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PlayerSourceIdentity" ADD CONSTRAINT "fk_41" FOREIGN KEY ("audit_event_id") REFERENCES "AuditEvent" ("audit_event_id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_0" CHECK ("pa" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_1" CHECK ("ab" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_2" CHECK ("h" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_3" CHECK ("doubles" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_4" CHECK ("triples" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_5" CHECK ("hr" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_6" CHECK ("bb" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_7" CHECK ("hbp" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_8" CHECK ("ibb" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_9" CHECK ("so" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_10" CHECK ("sf" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_11" CHECK ("sac" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_12" CHECK ("r" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_13" CHECK ("rbi" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_14" CHECK ("sb" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_15" CHECK ("cs" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_16" CHECK ("tb" >= 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_17" CHECK ("role" = 'BATTER');
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_18" CHECK ("bf" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_19" CHECK ("outs_recorded" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_20" CHECK ("h" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_21" CHECK ("er" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_22" CHECK ("r" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_23" CHECK ("bb" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_24" CHECK ("ibb" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_25" CHECK ("hbp" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_26" CHECK ("so" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_27" CHECK ("hr" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_28" CHECK ("np" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_29" CHECK ("sv" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_30" CHECK ("hld" >= 0);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_31" CHECK ((("role" = 'STARTER' AND "gs" = 1) OR ("role" = 'RELIEVER' AND "gs" = 0)));
ALTER TABLE "Season" ADD CONSTRAINT "check_32" CHECK ("year" BETWEEN 1900 AND 9999 AND "starts_on" <= "ends_on");
ALTER TABLE "Game" ADD CONSTRAINT "check_33" CHECK ("home_team_id" <> "away_team_id" AND "doubleheader_no" BETWEEN 0 AND 2 AND "record_revision" >= 1);
ALTER TABLE "Game" ADD CONSTRAINT "check_34" CHECK (("status" = 'FINAL' AND "played_on" IS NOT NULL AND "completed_at" IS NOT NULL) OR ("status" <> 'FINAL' AND "completed_at" IS NULL));
ALTER TABLE "Game" ADD CONSTRAINT "check_35" CHECK ("started_at" <= "completed_at");
ALTER TABLE "Game" ADD CONSTRAINT "check_36" CHECK ("status" <> 'CANCELLED' OR "played_on" IS NULL);
ALTER TABLE "Game" ADD CONSTRAINT "check_37" CHECK ("played_on" <= ("completed_at" AT TIME ZONE 'Asia/Seoul')::date);
ALTER TABLE "ImportBatch" ADD CONSTRAINT "check_38" CHECK ("schema_version" = '1.0.0' AND "as_of" <= "imported_at" AND "raw_hash" ~ '^[0-9a-f]{64}$' AND "canonical_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ImportBatch" ADD CONSTRAINT "check_39" CHECK ("status" = 'STAGED' OR "validation_report_ref" IS NOT NULL);
ALTER TABLE "DataLicense" ADD CONSTRAINT "check_40" CHECK ("version" > 0 AND cardinality("allowed_fields") BETWEEN 1 AND 200 AND cardinality("allowed_seasons") > 0 AND cardinality("allowed_competitions") > 0);
ALTER TABLE "DataLicense" ADD CONSTRAINT "check_41" CHECK ("expires_at" > "effective_at" AND ("status" <> 'REVOKED' OR "revoked_at" IS NOT NULL));
ALTER TABLE "RosterMember" ADD CONSTRAINT "check_42" CHECK ("effective_on" <= "snapshot_on" AND ("status" <> 'REGISTERED' OR "team_id" IS NOT NULL));
ALTER TABLE "PlayerTeamHistory" ADD CONSTRAINT "check_43" CHECK ("effective_on" <= "observed_on");
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "check_44" CHECK ("window" BETWEEN 1 AND 100 AND "computed_at" >= "cutoff_at");
ALTER TABLE "MomentumSnapshot" ADD CONSTRAINT "check_45" CHECK (("status" = 'READY' AND "value" IS NOT NULL) OR ("status" <> 'READY' AND "value" IS NULL));
ALTER TABLE "ScoringModelVersion" ADD CONSTRAINT "check_46" CHECK (("status" = 'PROPOSED' AND "adopted_at" IS NULL) OR ("status" <> 'PROPOSED' AND "adopted_at" IS NOT NULL));
ALTER TABLE "ImportRowIssue" ADD CONSTRAINT "check_47" CHECK ("row_number" > 0);
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_48" CHECK ("h" <= "ab");
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_49" CHECK ("ab" <= "pa");
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_50" CHECK ("so" <= "ab");
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_51" CHECK ("ibb" <= "bb");
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_52" CHECK (COALESCE("doubles",0)::bigint + COALESCE("triples",0) + COALESCE("hr",0) <= "h");
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_53" CHECK (COALESCE("ab",0)::bigint + COALESCE("bb",0) + COALESCE("hbp",0) + COALESCE("sf",0) + COALESCE("sac",0) <= "pa");
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_54" CHECK (("h" IS NULL OR "doubles" IS NULL OR "triples" IS NULL OR "hr" IS NULL) = ("tb" IS NULL));
ALTER TABLE "BattingGameLog" ADD CONSTRAINT "check_55" CHECK ("tb"::bigint = "h"::bigint + "doubles" + 2::bigint * "triples" + 3::bigint * "hr");
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_56" CHECK ("er" <= "r");
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_57" CHECK ("ibb" <= "bb");
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_58" CHECK ("hr" <= "h");
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_59" CHECK ("so" <= "bf");
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_60" CHECK (COALESCE("h",0)::bigint + COALESCE("bb",0) + COALESCE("hbp",0) <= "bf");
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_61" CHECK ("sv" <= 1 AND "hld" <= 1);
ALTER TABLE "PitchingGameLog" ADD CONSTRAINT "check_62" CHECK ("gs" + COALESCE("sv",0) + COALESCE("hld",0) <= 1);
ALTER TABLE "DataSource" ADD CONSTRAINT "check_63" CHECK ("source_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "DataLicense" ADD CONSTRAINT "check_64" CHECK ("rights_record_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "ImportBatch" ADD CONSTRAINT "check_65" CHECK ("batch_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "PlayerIdentity" ADD CONSTRAINT "check_66" CHECK ("player_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "Game" ADD CONSTRAINT "check_68" CHECK ("supersedes_batch_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "RosterMember" ADD CONSTRAINT "check_75" CHECK ("team_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "ScoringModelVersion" ADD CONSTRAINT "check_76" CHECK ("score_version_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "ImportRowIssue" ADD CONSTRAINT "check_77" CHECK ("issue_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "AuditEvent" ADD CONSTRAINT "check_78" CHECK ("audit_event_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "AuditEvent" ADD CONSTRAINT "check_79" CHECK ("batch_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "AuditEvent" ADD CONSTRAINT "check_80" CHECK ("source_id" ~ '^[a-z][a-z0-9_-]{0,63}$');
ALTER TABLE "AuditEvent" ADD CONSTRAINT "check_81" CHECK ("rights_record_id" ~ '^[a-z][a-z0-9_-]{0,63}$');

-- Names are deliberately nonunique; support contains searches with PostgreSQL core.
CREATE INDEX "player_name_search" ON "Player" (lower("display_name") text_pattern_ops);
ALTER TABLE "RosterSnapshot" ADD CONSTRAINT "roster_snapshot_date_key" UNIQUE (batch_id, snapshot_id, snapshot_on);
ALTER TABLE "RosterMember" ADD CONSTRAINT "roster_member_date_fk" FOREIGN KEY (batch_id, snapshot_id, snapshot_on)
 REFERENCES "RosterSnapshot" (batch_id, snapshot_id, snapshot_on) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Cross-row rules cannot be expressed as PostgreSQL CHECK constraints.
CREATE FUNCTION enforce_snapshot_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b "ImportBatch"%ROWTYPE;
BEGIN
 SELECT * INTO STRICT b FROM "ImportBatch" WHERE batch_id = NEW.batch_id;
 IF NEW.as_of > b.as_of THEN RAISE EXCEPTION 'row as_of exceeds batch as_of'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "Team_scope" AFTER INSERT OR UPDATE ON "Team" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "Player_scope" AFTER INSERT OR UPDATE ON "Player" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "Season_scope" AFTER INSERT OR UPDATE ON "Season" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "Competition_scope" AFTER INSERT OR UPDATE ON "Competition" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "Game_scope" AFTER INSERT OR UPDATE ON "Game" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "BattingGameLog_scope" AFTER INSERT OR UPDATE ON "BattingGameLog" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "PitchingGameLog_scope" AFTER INSERT OR UPDATE ON "PitchingGameLog" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "RosterSnapshot_scope" AFTER INSERT OR UPDATE ON "RosterSnapshot" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "RosterMember_scope" AFTER INSERT OR UPDATE ON "RosterMember" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "PlayerTeamHistory_scope" AFTER INSERT OR UPDATE ON "PlayerTeamHistory" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();
CREATE CONSTRAINT TRIGGER "MomentumSnapshot_scope" AFTER INSERT OR UPDATE ON "MomentumSnapshot" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_scope();

CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable history: append a new batch/version/event'; END $$;
CREATE TRIGGER "DataLicense_immutable" BEFORE UPDATE OR DELETE ON "DataLicense" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "ImportBatch_immutable" BEFORE UPDATE OR DELETE ON "ImportBatch" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Team_immutable" BEFORE UPDATE OR DELETE ON "Team" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Player_immutable" BEFORE UPDATE OR DELETE ON "Player" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Season_immutable" BEFORE UPDATE OR DELETE ON "Season" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Competition_immutable" BEFORE UPDATE OR DELETE ON "Competition" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Game_immutable" BEFORE UPDATE OR DELETE ON "Game" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "BattingGameLog_immutable" BEFORE UPDATE OR DELETE ON "BattingGameLog" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "PitchingGameLog_immutable" BEFORE UPDATE OR DELETE ON "PitchingGameLog" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "RosterSnapshot_immutable" BEFORE UPDATE OR DELETE ON "RosterSnapshot" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "RosterMember_immutable" BEFORE UPDATE OR DELETE ON "RosterMember" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "PlayerTeamHistory_immutable" BEFORE UPDATE OR DELETE ON "PlayerTeamHistory" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "MomentumSnapshot_immutable" BEFORE UPDATE OR DELETE ON "MomentumSnapshot" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "ScoringModelVersion_immutable" BEFORE UPDATE OR DELETE ON "ScoringModelVersion" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "AuditEvent_immutable" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "PlayerSourceIdentity_immutable" BEFORE UPDATE OR DELETE ON "PlayerSourceIdentity" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
COMMIT;

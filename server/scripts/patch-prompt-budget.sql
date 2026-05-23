CREATE TABLE IF NOT EXISTS prompt_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_config_id UUID NOT NULL REFERENCES prompt_configs(id) ON UPDATE CASCADE ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  change_note VARCHAR(500),
  created_by UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS prompt_config_versions_config_version_uq
  ON prompt_config_versions (prompt_config_id, version_number);

CREATE TABLE IF NOT EXISTS llm_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS llm_usage_daily_user_date_uq
  ON llm_usage_daily (user_id, usage_date);

INSERT INTO "SequelizeMeta" (name)
SELECT '20250523000002-create-prompt-config-versions.js'
WHERE NOT EXISTS (
  SELECT 1 FROM "SequelizeMeta" WHERE name = '20250523000002-create-prompt-config-versions.js'
);

INSERT INTO "SequelizeMeta" (name)
SELECT '20250523000003-create-llm-usage-daily.js'
WHERE NOT EXISTS (
  SELECT 1 FROM "SequelizeMeta" WHERE name = '20250523000003-create-llm-usage-daily.js'
);

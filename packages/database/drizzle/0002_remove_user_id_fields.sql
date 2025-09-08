-- Remove user_id fields from model_configs and model_presets tables
-- Also remove from mcp_tool_executions table since there are no user accounts

-- Drop indexes first
DROP INDEX IF EXISTS model_configs_user_idx;
DROP INDEX IF EXISTS model_presets_user_idx;

-- Remove user_id columns
ALTER TABLE model_configs DROP COLUMN user_id;
ALTER TABLE model_presets DROP COLUMN user_id;
ALTER TABLE mcp_tool_executions DROP COLUMN user_id;

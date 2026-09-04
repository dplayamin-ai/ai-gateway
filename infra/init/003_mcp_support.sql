ALTER TABLE mcp_servers ALTER COLUMN network_type DROP NOT NULL;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS bearer_token text;

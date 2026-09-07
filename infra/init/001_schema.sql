CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,  
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE information_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  
  code varchar(100) NOT NULL,
  name varchar(200) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,  
  endpoint text NOT NULL DEFAULT '',
  api_key_ciphertext text NOT NULL,
  provider_id uuid NOT NULL REFERENCES providers(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A system may be consumed by more than one tenant. tenant_id is retained
-- for compatibility with older integrations; new relationships use this table.
CREATE TABLE information_system_tenants (
  information_system_id uuid NOT NULL REFERENCES information_systems(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (information_system_id, tenant_id)
);
CREATE INDEX idx_system_tenants_tenant ON information_system_tenants(information_system_id);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'AUDITOR')),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE model_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias varchar(100) NOT NULL UNIQUE,
  provider_id uuid NOT NULL REFERENCES providers(id),
  provider_model varchar(200) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  endpoint text NOT NULL,
  network_type varchar(20) CHECK (network_type IN ('INTERNAL', 'EXTERNAL')),
  bearer_token text,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEGRADED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mcp_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_server_id uuid NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (mcp_server_id, name)
);

CREATE TABLE api_key_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  information_system_id uuid NOT NULL REFERENCES information_systems(id),
  applicant_name varchar(100) NOT NULL,
  applicant_email varchar(320) NOT NULL,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by uuid REFERENCES admin_users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_key_request_resources (
  request_id uuid NOT NULL REFERENCES api_key_requests(id) ON DELETE CASCADE,
  resource_type varchar(20) NOT NULL CHECK (resource_type IN ('MODEL', 'MCP')),
  resource_id uuid NOT NULL,
  PRIMARY KEY (request_id, resource_type, resource_id)
);

CREATE TABLE api_key_request_tenants (
  request_id uuid NOT NULL REFERENCES api_key_requests(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (request_id, tenant_id)
);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES api_key_requests(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  information_system_id uuid NOT NULL REFERENCES information_systems(id),
  key_prefix varchar(20) NOT NULL,
  key_hash varchar(128) NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_key_resources (
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  resource_type varchar(20) NOT NULL CHECK (resource_type IN ('MODEL', 'MCP')),
  resource_id uuid NOT NULL,
  PRIMARY KEY (api_key_id, resource_type, resource_id)
);

CREATE TABLE api_key_tenants (
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (api_key_id, tenant_id)
);

CREATE TABLE usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id varchar(100) NOT NULL UNIQUE,
  api_key_id uuid REFERENCES api_keys(id),
  tenant_id uuid,
  information_system_id uuid REFERENCES information_systems(id),
  agent_id varchar(200),
  request_type varchar(20) NOT NULL CHECK (request_type IN ('MODEL', 'MCP')),
  resource_name varchar(200) NOT NULL,
  provider_name varchar(200),
  status varchar(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
  error_code varchar(50),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  latency_ms integer CHECK (latency_ms >= 0),
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES admin_users(id),
  action varchar(100) NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system_settings (
  key varchar(100) PRIMARY KEY,
  value text NOT NULL,
  description varchar(300),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX idx_key_requests_status ON api_key_requests(status, created_at DESC);
CREATE INDEX idx_api_keys_tenant_status ON api_keys(tenant_id, status);
CREATE INDEX idx_usage_logs_tenant_time ON usage_logs(tenant_id, requested_at DESC);
CREATE INDEX idx_usage_logs_resource_time ON usage_logs(resource_name, requested_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER systems_updated_at BEFORE UPDATE ON information_systems FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER admins_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER models_updated_at BEFORE UPDATE ON model_aliases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER mcps_updated_at BEFORE UPDATE ON mcp_servers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER requests_updated_at BEFORE UPDATE ON api_key_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

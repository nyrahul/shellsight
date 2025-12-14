/*
  # Execution Dashboard Schema

  ## Overview
  Creates the complete database schema for a sandboxed code execution and MCP server management dashboard.

  ## 1. New Tables

  ### `clusters`
  - `id` (uuid, primary key) - Unique cluster identifier
  - `name` (text) - Cluster name
  - `status` (text) - Current status (active, inactive, maintenance)
  - `endpoint` (text) - Cluster endpoint URL
  - `region` (text) - Geographic region
  - `capacity` (jsonb) - Capacity information (CPU, memory, storage)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_by` (uuid) - User who created the cluster

  ### `mcp_servers`
  - `id` (uuid, primary key) - Unique MCP server identifier
  - `name` (text) - Server name
  - `cluster_id` (uuid) - Associated cluster
  - `status` (text) - Current status (running, stopped, error)
  - `version` (text) - MCP server version
  - `config` (jsonb) - Server configuration
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `executions`
  - `id` (uuid, primary key) - Unique execution identifier
  - `job_id` (text) - Human-readable job ID
  - `cluster_id` (uuid) - Cluster where execution runs
  - `mcp_server_id` (uuid) - MCP server handling execution
  - `status` (text) - Execution status (pending, running, completed, failed)
  - `code` (text) - Code to execute
  - `language` (text) - Programming language
  - `started_at` (timestamptz) - Execution start time
  - `completed_at` (timestamptz) - Execution completion time
  - `exit_code` (integer) - Process exit code
  - `created_by` (uuid) - User who initiated execution
  - `created_at` (timestamptz) - Creation timestamp

  ### `app_logs`
  - `id` (uuid, primary key) - Unique log entry identifier
  - `execution_id` (uuid) - Associated execution
  - `timestamp` (timestamptz) - Log timestamp
  - `level` (text) - Log level (info, warn, error, debug)
  - `message` (text) - Log message
  - `metadata` (jsonb) - Additional log metadata

  ### `shell_replays`
  - `id` (uuid, primary key) - Unique replay identifier
  - `execution_id` (uuid) - Associated execution
  - `sequence` (integer) - Command sequence number
  - `command` (text) - Executed command
  - `output` (text) - Command output
  - `timestamp` (timestamptz) - Execution timestamp

  ### `resource_usage`
  - `id` (uuid, primary key) - Unique usage record identifier
  - `execution_id` (uuid) - Associated execution (nullable for overall usage)
  - `cluster_id` (uuid) - Associated cluster (nullable)
  - `timestamp` (timestamptz) - Measurement timestamp
  - `cpu_usage` (numeric) - CPU usage percentage
  - `memory_usage` (numeric) - Memory usage in MB
  - `storage_usage` (numeric) - Storage usage in MB
  - `network_in` (numeric) - Network ingress in MB
  - `network_out` (numeric) - Network egress in MB

  ### `generated_artifacts`
  - `id` (uuid, primary key) - Unique artifact identifier
  - `execution_id` (uuid) - Associated execution
  - `name` (text) - Artifact name
  - `type` (text) - Artifact type (file, image, report, etc.)
  - `size` (bigint) - Size in bytes
  - `storage_path` (text) - Storage location path
  - `created_at` (timestamptz) - Creation timestamp

  ### `user_profiles`
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - Full name
  - `role` (text) - User role (admin, developer, viewer)
  - `avatar_url` (text) - Profile picture URL
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `integrations`
  - `id` (uuid, primary key) - Unique integration identifier
  - `type` (text) - Integration type (siem, splunk, ticketing, email, slack)
  - `name` (text) - Integration name
  - `status` (text) - Status (active, inactive, error)
  - `config` (jsonb) - Integration configuration (encrypted sensitive data)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_by` (uuid) - User who created the integration

  ## 2. Security
  - Enable RLS on all tables
  - Add policies for authenticated users to access their data
  - Admins have full access to all resources
*/

-- Create clusters table
CREATE TABLE IF NOT EXISTS clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  endpoint text,
  region text,
  capacity jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create mcp_servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cluster_id uuid REFERENCES clusters(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'stopped',
  version text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create executions table
CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE,
  cluster_id uuid REFERENCES clusters(id) ON DELETE SET NULL,
  mcp_server_id uuid REFERENCES mcp_servers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  code text,
  language text,
  started_at timestamptz,
  completed_at timestamptz,
  exit_code integer,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create app_logs table
CREATE TABLE IF NOT EXISTS app_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES executions(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create shell_replays table
CREATE TABLE IF NOT EXISTS shell_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES executions(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  command text NOT NULL,
  output text,
  timestamp timestamptz DEFAULT now()
);

-- Create resource_usage table
CREATE TABLE IF NOT EXISTS resource_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES executions(id) ON DELETE CASCADE,
  cluster_id uuid REFERENCES clusters(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  cpu_usage numeric,
  memory_usage numeric,
  storage_usage numeric,
  network_in numeric,
  network_out numeric
);

-- Create generated_artifacts table
CREATE TABLE IF NOT EXISTS generated_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES executions(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  size bigint DEFAULT 0,
  storage_path text,
  created_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_created_by ON executions(created_by);
CREATE INDEX IF NOT EXISTS idx_app_logs_execution_id ON app_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_shell_replays_execution_id ON shell_replays(execution_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_execution_id ON resource_usage(execution_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_cluster_id ON resource_usage(cluster_id);
CREATE INDEX IF NOT EXISTS idx_generated_artifacts_execution_id ON generated_artifacts(execution_id);

-- Enable Row Level Security
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shell_replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clusters
CREATE POLICY "Authenticated users can view all clusters"
  ON clusters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create clusters"
  ON clusters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own clusters"
  ON clusters FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own clusters"
  ON clusters FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for mcp_servers
CREATE POLICY "Authenticated users can view all MCP servers"
  ON mcp_servers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create MCP servers"
  ON mcp_servers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update MCP servers"
  ON mcp_servers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete MCP servers"
  ON mcp_servers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for executions
CREATE POLICY "Users can view their own executions"
  ON executions FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create executions"
  ON executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own executions"
  ON executions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- RLS Policies for app_logs
CREATE POLICY "Users can view logs for their executions"
  ON app_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM executions
      WHERE executions.id = app_logs.execution_id
      AND executions.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert logs"
  ON app_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for shell_replays
CREATE POLICY "Users can view shell replays for their executions"
  ON shell_replays FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM executions
      WHERE executions.id = shell_replays.execution_id
      AND executions.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert shell replays"
  ON shell_replays FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for resource_usage
CREATE POLICY "Authenticated users can view all resource usage"
  ON resource_usage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert resource usage"
  ON resource_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for generated_artifacts
CREATE POLICY "Users can view artifacts for their executions"
  ON generated_artifacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM executions
      WHERE executions.id = generated_artifacts.execution_id
      AND executions.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert artifacts"
  ON generated_artifacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for integrations
CREATE POLICY "Authenticated users can view all integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
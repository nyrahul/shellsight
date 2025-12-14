export interface Cluster {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  endpoint: string;
  region: string;
  capacity: {
    cpu?: number;
    memory?: number;
    storage?: number;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface MCPServer {
  id: string;
  name: string;
  cluster_id: string;
  status: 'running' | 'stopped' | 'error';
  version: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  job_id: string;
  cluster_id: string;
  mcp_server_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  code: string;
  language: string;
  started_at: string;
  completed_at: string;
  exit_code: number;
  created_by: string;
  created_at: string;
}

export interface AppLog {
  id: string;
  execution_id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, unknown>;
}

export interface ShellReplay {
  id: string;
  execution_id: string;
  sequence: number;
  command: string;
  output: string;
  timestamp: string;
}

export interface ResourceUsage {
  id: string;
  execution_id: string | null;
  cluster_id: string | null;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  storage_usage: number;
  network_in: number;
  network_out: number;
}

export interface GeneratedArtifact {
  id: string;
  execution_id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'developer' | 'viewer';
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  type: 'siem' | 'splunk' | 'ticketing' | 'email' | 'slack';
  name: string;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

#!/bin/bash
docker exec automation-postgres psql -U automation -d automation << 'EOF'
-- MCP Integration Service Schema Update Migration
-- Update mcp_servers table to match new Prisma schema

-- Add new columns
ALTER TABLE mcp_servers 
ADD COLUMN IF NOT EXISTS transport VARCHAR(20),
ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS command VARCHAR(500),
ADD COLUMN IF NOT EXISTS args TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ssh_config JSONB,
ADD COLUMN IF NOT EXISTS docker_config JSONB,
ADD COLUMN IF NOT EXISTS http_config JSONB,
ADD COLUMN IF NOT EXISTS server_info JSONB,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_mcp_servers_transport ON mcp_servers(transport);

-- Update status column default
ALTER TABLE mcp_servers ALTER COLUMN status SET DEFAULT 'inactive';

-- Drop old check constraint if exists
ALTER TABLE mcp_servers DROP CONSTRAINT IF EXISTS mcp_servers_status_check;

\q
EOF

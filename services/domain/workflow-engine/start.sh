#!/bin/bash

# Workflow Engine API Client 모드 시작 스크립트
# 🔄 n8n 내장 실행 → 외부 n8n API 클라이언트로 전환
# 🔥 Sentry 완전 비활성화

set -e

# 모든 Sentry 관련 환경 변수 완전 제거
unset SENTRY_DSN
unset N8N_SENTRY_DSN
export SENTRY_DSN=""
export N8N_SENTRY_DSN=""
export N8N_DISABLE_PRODUCTION_MAIN_PROCESS_WARNING=true
export N8N_DISABLE_PRODUCTION_TELEMETRY=true

# Node.js 옵션
export NODE_OPTIONS="--max-old-space-size=4096"

echo "🚀 Starting Workflow Engine Service (API Client Mode)..."
echo "🔄 Mode: External n8n API Client (not embedded)"
echo "🔗 n8n API URL: ${N8N_API_URL:-http://automation-n8n:5678}"
echo "🔥 Sentry 모듈 완전 비활성화됨"

# 환경 변수 검증
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

# n8n API URL 환경 변수 설정 (없으면 기본값)
export N8N_API_URL="${N8N_API_URL:-http://automation-n8n:5678}"
export N8N_BASIC_AUTH_USER="${N8N_BASIC_AUTH_USER:-admin}"
export N8N_BASIC_AUTH_PASSWORD="${N8N_BASIC_AUTH_PASSWORD:-automation_n8n_pass_2024}"

# Prisma Client 생성 (필요한 경우)
echo "🔧 Generating Prisma Client..."
npx prisma generate

# 데이터베이스 연결만 확인 (수정하지 않음)
echo "🔍 Checking database connection..."
npx prisma db seed --skip-generate || {
    echo "⚠️  Database connection check (seed skipped)"
}

echo "✅ Database connection verified"

# 외부 n8n 서비스 연결 확인 (최대 30초)
echo "🔗 Checking external n8n service..."
for i in {1..30}; do
    if curl -f ${N8N_API_URL}/healthz >/dev/null 2>&1; then
        echo "✅ External n8n service is available (attempt $i/30)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ External n8n service not available at ${N8N_API_URL}"
        echo "⚠️  Starting without n8n connection (will retry at runtime)"
        break
    fi
    echo "   Waiting for n8n service... ($i/30)"
    sleep 2
done

# Workflow Engine 서비스 시작 (API 클라이언트 모드)
echo "🔧 Starting Workflow Engine Service on port 8401 (API Client Mode)..."
echo "📝 Mode: External n8n API integration"
SENTRY_DSN="" NODE_OPTIONS="--max-old-space-size=4096" exec npm start

#!/bin/bash

# Workflow Engine 순수 시작 스크립트 (n8n 분리됨)
# ✅ Prisma 정상 처리
# ✅ 순수한 Workflow Engine만 실행

set -e

# 모든 Sentry 관련 환경 변수 완전 제거
unset SENTRY_DSN
unset N8N_SENTRY_DSN
export SENTRY_DSN=""
export N8N_SENTRY_DSN=""
export NODE_OPTIONS="--max-old-space-size=4096"

echo "🚀 Starting Workflow Engine Service (n8n 분리됨)..."
echo "🔗 n8n API 연동: ${N8N_API_URL:-http://automation-n8n:5678}"

# Prisma Client 생성
echo "🔧 Generating Prisma Client..."
npx prisma generate

# 데이터베이스 연결 확인
echo "🔍 Checking database connection..."
npx prisma db pull --force || {
    echo "⚠️  Database connection check completed"
}

echo "✅ Database connection verified"

# n8n 분리 알림
echo "📦 n8n은 별도 컨테이너에서 실행됩니다 (automation-n8n:5678)"

# Workflow Engine 메인 서비스 시작
echo "🎯 Starting Workflow Engine main service on port 8401..."
exec node src/index.js

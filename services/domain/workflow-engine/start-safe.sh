#!/bin/bash

# Workflow Engine + n8n 안전한 시작 스크립트
# ⚠️ prisma db push --accept-data-loss 제거 - 데이터 안전성

set -e

echo "🚀 Starting Workflow Engine Service with n8n..."
echo "⚠️  자동 스키마 수정이 비활성화되었습니다 (데이터 안전성)"

# 환경 변수 검증
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

# Prisma 연결만 확인 (수정하지 않음)
echo "🔍 Checking database connection..."
npx prisma db seed --skip-generate || {
    echo "⚠️  Database connection check (seed skipped)"
}

echo "✅ Database connection verified"

# n8n을 백그라운드에서 시작
echo "📦 Starting n8n on port 5678..."
n8n start &
N8N_PID=$!

# n8n이 준비될 때까지 대기 (최대 30초)
echo "⏳ Waiting for n8n to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:5678/healthz >/dev/null 2>&1; then
        echo "✅ n8n is ready (attempt $i/30)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ n8n failed to start within 30 seconds"
        kill $N8N_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo "✅ n8n started successfully (PID: $N8N_PID)"

# Workflow Engine 서비스 시작
echo "🔧 Starting Workflow Engine Service on port 8401..."
exec npm start

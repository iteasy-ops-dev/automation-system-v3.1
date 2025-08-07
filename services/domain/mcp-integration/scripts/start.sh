#!/bin/sh

# MCP Service 시작 스크립트
# Prisma 마이그레이션을 자동으로 실행한 후 서비스 시작

echo "🔄 MCP Service: Prisma 마이그레이션 실행 중..."
npx prisma migrate deploy

# 마이그레이션 실패 시에도 서비스는 시작 (기존 스키마로 동작)
if [ $? -ne 0 ]; then
    echo "⚠️  마이그레이션 실패, 기존 스키마로 서비스 시작"
fi

# transport 필드 기본값 설정 (기존 데이터 호환성)
echo "🔧 기존 데이터 호환성 처리..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "UPDATE mcp_servers SET transport = 'http' WHERE transport IS NULL;" 2>/dev/null || true

echo "🚀 MCP Service 시작..."
exec node dist/app.js

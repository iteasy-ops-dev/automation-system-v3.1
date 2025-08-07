#!/bin/bash

# MCP Service 안전한 시작 스크립트
# ⚠️ 자동 스키마 수정 비활성화 - 데이터 안전성을 위해

set -e

echo "🔧 MCP Integration Service 시작 중..."
echo "⚠️  자동 스키마 수정이 비활성화되었습니다 (데이터 안전성)"

# 데이터베이스 연결 대기
echo "📡 PostgreSQL 연결 대기 중..."
while ! pg_isready -h ${POSTGRES_HOST:-postgres} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-postgres} >/dev/null 2>&1; do
  echo "⏳ PostgreSQL 연결 대기 중... (5초 후 재시도)"
  sleep 5
done

echo "✅ PostgreSQL 연결 확인"

# ⚠️ 스키마 수정 부분 완전 제거
echo "📌 스키마 수정은 수동으로 관리됩니다"

# Prisma Client는 이미 빌드 시 생성됨
echo "✅ MCP 준비 완료"

# MCP Service 시작
echo "🚀 MCP Integration Service 시작..."
exec npm start

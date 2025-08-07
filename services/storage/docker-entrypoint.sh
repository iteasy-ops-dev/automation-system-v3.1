#!/bin/bash

# Storage Service 안전한 시작 스크립트
# ⚠️ 자동 스키마 수정 비활성화 - 데이터 안전성을 위해

set -e

echo "🚀 Storage Service 시작 중..."
echo "📅 $(date)"
echo "⚠️  자동 스키마 수정이 비활성화되었습니다 (데이터 안전성)"

# 환경변수 확인
echo "🔍 환경변수 확인:"
echo "  - POSTGRES_HOST: ${POSTGRES_HOST:-postgres}"
echo "  - POSTGRES_PORT: ${POSTGRES_PORT:-5432}"
echo "  - POSTGRES_DB: ${POSTGRES_DB:-automation}"

# PostgreSQL 연결 대기 (최대 60초)
echo "📡 PostgreSQL 연결 대기 중..."
TIMEOUT=60
ELAPSED=0

while ! pg_isready -h ${POSTGRES_HOST:-postgres} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-postgres} >/dev/null 2>&1; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "❌ PostgreSQL 연결 실패: ${TIMEOUT}초 초과"
    exit 1
  fi
  echo "⏳ PostgreSQL 연결 대기 중... (${ELAPSED}/${TIMEOUT}초)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo "✅ PostgreSQL 연결 확인 (${ELAPSED}초 소요)"

# 데이터베이스 존재 여부만 확인 (수정하지 않음)
echo "🔍 데이터베이스 존재 여부 확인..."
DB_EXISTS=$(PGPASSWORD=${POSTGRES_PASSWORD:-password} psql \
  -h ${POSTGRES_HOST:-postgres} \
  -p ${POSTGRES_PORT:-5432} \
  -U ${POSTGRES_USER:-postgres} \
  -lqt | cut -d \| -f 1 | grep -w ${POSTGRES_DB:-automation} | wc -l)

if [ "$DB_EXISTS" -eq "0" ]; then
  echo "❌ 데이터베이스 '${POSTGRES_DB:-automation}'가 존재하지 않습니다"
  exit 1
fi

echo "✅ 데이터베이스 '${POSTGRES_DB:-automation}' 확인"

# ⚠️ 스키마 수정 부분 완전 제거 - 데이터 안전성
echo "📌 스키마 수정은 수동으로 관리됩니다"

# Prisma Client 재생성만 수행
echo "🔄 Prisma Client 재생성 중..."
npx prisma generate

echo "✅ Prisma Client 재생성 완료"

# Storage Service 시작
echo "🚀 Storage Service 애플리케이션 시작..."
echo "📅 $(date)"

exec npm start

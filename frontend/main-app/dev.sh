#!/bin/bash

# Development Script for Main App
# 이 스크립트를 사용하면 재빌드 없이 실시간 개발 가능

echo "🚀 Starting Main App Development Server..."
echo ""
echo "📡 API Server: http://localhost:8080"
echo "🌐 Frontend Dev Server: http://localhost:3001"
echo "🔄 Hot Reload: Enabled"
echo ""

cd "$(dirname "$0")"

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# 환경 변수 설정
export NODE_ENV=development
export VITE_API_BASE_URL=http://localhost:8080
export VITE_WS_HOST=localhost:8080

# 개발 서버 시작
echo "🔄 Starting Vite dev server..."
npm run dev

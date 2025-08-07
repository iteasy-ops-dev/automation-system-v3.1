#!/bin/bash

# 간단한 Workflow Engine 시작 스크립트 (n8n 없이)
echo "🚀 Starting Simple Workflow Engine Service..."

# Prisma Client 생성
npx prisma generate || echo "⚠️ Prisma generate failed, continuing..."

# Node.js 애플리케이션 시작
exec node src/index.js

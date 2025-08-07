#!/bin/bash
# 통합 모놀리스 마이그레이션 스크립트

set -e

echo "🚀 통합 모놀리스 마이그레이션 시작"
echo "================================"

# 변수 설정
CURRENT_DIR="/Users/leesg/Documents/work_ops/automation-system"
NEW_DIR="/Users/leesg/Documents/work_ops/automation-system-unified"
BACKUP_ID="backup_before_monolith_$(date +%Y%m%d_%H%M%S)"

# 1. 백업 생성
echo "📦 Step 1: 현재 시스템 백업..."
cd "$CURRENT_DIR"
if [ -f "./smart-backup.sh" ]; then
    ./smart-backup.sh
else
    echo "⚠️  백업 스크립트가 없습니다. 수동 백업을 권장합니다."
fi

# 2. 새 프로젝트 구조 생성
echo "📁 Step 2: 새 프로젝트 구조 생성..."
mkdir -p "$NEW_DIR"
cd "$NEW_DIR"

# 디렉토리 구조
mkdir -p backend/{src,prisma,tests,scripts}
mkdir -p backend/src/{modules,shared,config,middleware}
mkdir -p backend/src/modules/{auth,devices,mcp,llm,workflows,chat}
mkdir -p backend/src/shared/{database,cache,events,utils,types}
mkdir -p frontend
mkdir -p {scripts,docs,docker}

# 3. 기본 파일 생성
echo "📝 Step 3: 기본 설정 파일 생성..."

# package.json
cat > backend/package.json << 'EOF'
{
  "name": "automation-system-unified-backend",
  "version": "1.0.0",
  "description": "Unified monolith backend for automation system",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.ts",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "zod": "^3.21.4",
    "winston": "^3.8.2",
    "bull": "^4.10.4",
    "ioredis": "^5.3.1",
    "axios": "^1.4.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0"
  },
  "devDependencies": {
    "@types/node": "^18.15.0",
    "@types/express": "^4.17.17",
    "typescript": "^5.0.0",
    "nodemon": "^2.0.22",
    "ts-node": "^10.9.1",
    "prisma": "^5.0.0",
    "jest": "@^29.5.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "eslint": "^8.40.0",
    "@typescript-eslint/parser": "^5.59.0",
    "@typescript-eslint/eslint-plugin": "^5.59.0"
  }
}
EOF

# tsconfig.json
cat > backend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "paths": {
      "@/*": ["./src/*"],
      "@modules/*": ["./src/modules/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# .env.example
cat > backend/.env.example << 'EOF'
# Server
NODE_ENV=development
PORT=8000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/automation

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=1h

# MongoDB (for workflow/chat history)
MONGODB_URL=mongodb://localhost:27017/automation

# External Services
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EOF

# docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:automation2024@postgres:5432/automation
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=automation-secret-2024
    depends_on:
      - postgres
      - redis
      - mongodb
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=automation
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=automation2024
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mongodb:
    image: mongo:6
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=automation2024
      - MONGO_INITDB_DATABASE=automation
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  postgres_data:
  redis_data:
  mongodb_data:
EOF

# Backend Dockerfile
cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]
EOF

echo "✅ Step 3 완료: 기본 설정 파일 생성됨"

# 4. 마이그레이션 도우미 스크립트
echo "🔧 Step 4: 마이그레이션 도우미 스크립트 생성..."

cat > scripts/copy-business-logic.sh << 'EOF'
#!/bin/bash
# 비즈니스 로직 복사 스크립트

ORIGINAL_DIR="/Users/leesg/Documents/work_ops/automation-system"
TARGET_DIR="/Users/leesg/Documents/work_ops/automation-system-unified/backend/src/modules"

echo "📦 비즈니스 로직 복사 시작..."

# Device Service
echo "  - Device Service 로직 복사..."
cp -r "$ORIGINAL_DIR/services/domain/device-management/src/services" "$TARGET_DIR/devices/"
cp -r "$ORIGINAL_DIR/services/domain/device-management/src/controllers" "$TARGET_DIR/devices/"

# MCP Service
echo "  - MCP Service 로직 복사..."
cp -r "$ORIGINAL_DIR/services/domain/mcp-integration/src/services" "$TARGET_DIR/mcp/"
cp -r "$ORIGINAL_DIR/services/domain/mcp-integration/src/controllers" "$TARGET_DIR/mcp/"

# LLM Service
echo "  - LLM Service 로직 복사..."
cp -r "$ORIGINAL_DIR/services/domain/llm/src/services" "$TARGET_DIR/llm/"
cp -r "$ORIGINAL_DIR/services/domain/llm/src/controllers" "$TARGET_DIR/llm/"

# Workflow Engine
echo "  - Workflow Engine 로직 복사..."
cp -r "$ORIGINAL_DIR/services/domain/workflow-engine/src/services" "$TARGET_DIR/workflows/"
cp -r "$ORIGINAL_DIR/services/domain/workflow-engine/src/controllers" "$TARGET_DIR/workflows/"

echo "✅ 비즈니스 로직 복사 완료!"
EOF

chmod +x scripts/copy-business-logic.sh

# 5. README 생성
cat > README.md << 'EOF'
# Automation System Unified (모놀리스 버전)

## 개요
마이크로서비스 아키텍처에서 모놀리스로 전환한 통합 자동화 시스템입니다.

## 구조
- `backend/` - 통합 백엔드 (Express + Prisma)
- `frontend/` - React 프론트엔드 (기존 재사용)
- `scripts/` - 유틸리티 스크립트
- `docs/` - 문서

## 시작하기

### 1. 의존성 설치
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. 데이터베이스 설정
```bash
cd backend
npx prisma migrate dev
```

### 3. 개발 서버 실행
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && npm start
```

### 4. Docker로 실행
```bash
docker-compose up -d
```

## 마이그레이션 진행 상황
- [ ] 프로젝트 구조 생성
- [ ] Prisma 스키마 통합
- [ ] 비즈니스 로직 이전
- [ ] API 라우트 통합
- [ ] WebSocket 통합
- [ ] Frontend 연결
- [ ] 테스트 작성
- [ ] 배포 준비
EOF

echo "✅ 마이그레이션 준비 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. cd $NEW_DIR"
echo "2. ./scripts/copy-business-logic.sh 실행"
echo "3. Prisma 스키마 통합 작업"
echo "4. Import 경로 수정"
echo "5. 통합 테스트"

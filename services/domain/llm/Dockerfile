# LLM Service Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# 프로덕션 이미지
FROM node:18-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S llmservice -u 1001

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# 빌드된 앱 복사
COPY --from=builder /app/dist ./dist

# 로그 디렉토리 생성
RUN mkdir -p logs && chown -R llmservice:nodejs logs

# 사용자 전환
USER llmservice

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8301/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 포트 노출
EXPOSE 8301

# 앱 시작
CMD ["node", "dist/index.js"]
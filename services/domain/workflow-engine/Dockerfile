# Minimal Workflow Engine - No Sentry, No n8n
FROM node:20-bullseye-slim

# curl만 설치
RUN apt-get update && apt-get install -y curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 환경 변수 설정 (모든 Sentry 관련 완전 비활성화)
ENV SENTRY_DSN=""
ENV NODE_ENV=production

# 패키지 파일 복사
COPY package.json ./

# 최소한의 의존성만 설치 (Sentry 없이)
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

# Prisma 스키마 복사 및 생성
COPY prisma ./prisma/
ENV DATABASE_URL="postgresql://postgres:password@postgres:5432/automation"
RUN npx prisma generate

# 소스 코드 복사
COPY src ./src

# 포트 노출
EXPOSE 8401

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8401/health || exit 1

# 정상적인 시작 스크립트
COPY start-fixed.sh ./start-fixed.sh
RUN chmod +x start-fixed.sh

CMD ["./start-fixed.sh"]

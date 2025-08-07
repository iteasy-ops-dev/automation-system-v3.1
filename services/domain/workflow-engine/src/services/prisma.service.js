const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

class PrismaService {
  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'colorless'
    });
    
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      logger.info('✅ Prisma 데이터베이스 연결 성공');
    } catch (error) {
      logger.error('❌ Prisma 데이터베이스 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('🔌 Prisma 데이터베이스 연결 해제');
    } catch (error) {
      logger.error('❌ Prisma 연결 해제 실패:', error);
    }
  }

  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('❌ Prisma 헬스체크 실패:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  getClient() {
    if (!this.isConnected) {
      throw new Error('Prisma client is not connected. Call connect() first.');
    }
    return this.prisma;
  }

  // 트랜잭션 래퍼
  async transaction(callback) {
    return await this.prisma.$transaction(callback);
  }

  // 안전한 쿼리 실행을 위한 래퍼
  async executeQuery(queryFn, errorMessage = 'Database query failed') {
    try {
      return await queryFn(this.prisma);
    } catch (error) {
      logger.error(`${errorMessage}:`, error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
const prismaService = new PrismaService();

module.exports = prismaService;
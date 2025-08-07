/**
 * Prisma 데이터베이스 설정 - 타입 에러 수정
 * TASK-4-PRISMA: Storage Service Prisma 전환
 * 계약 100% 준수 설정
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

export class DatabaseConfig {
  private static instance: PrismaClient;
  private static logger: Logger = new Logger('DatabaseConfig');

  /**
   * Prisma 클라이언트 싱글톤 인스턴스 반환
   */
  public static getInstance(): PrismaClient {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new PrismaClient({
        errorFormat: 'pretty',
      });

      // 간단한 로깅 설정 (타입 에러 방지)
      DatabaseConfig.logger.info('Prisma client initialized');
    }

    return DatabaseConfig.instance;
  }

  /**
   * 데이터베이스 연결 확인
   */
  public static async testConnection(): Promise<boolean> {
    try {
      const prisma = DatabaseConfig.getInstance();
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      DatabaseConfig.logger.info('Database connection successful');
      return true;
    } catch (error) {
      DatabaseConfig.logger.error('Database connection failed', error);
      return false;
    }
  }

  /**
   * 애플리케이션 종료 시 연결 해제
   */
  public static async disconnect(): Promise<void> {
    try {
      if (DatabaseConfig.instance) {
        await DatabaseConfig.instance.$disconnect();
        DatabaseConfig.logger.info('Database disconnected successfully');
      }
    } catch (error) {
      DatabaseConfig.logger.error('Error disconnecting database', error);
    }
  }

  /**
   * 트랜잭션 실행 헬퍼
   */
  public static async transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const prisma = DatabaseConfig.getInstance();
    return await prisma.$transaction(fn);
  }
}

// 기본 내보내기
export const prisma = DatabaseConfig.getInstance();
export default DatabaseConfig;

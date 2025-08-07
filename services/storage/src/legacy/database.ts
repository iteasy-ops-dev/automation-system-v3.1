// Database Configuration - TASK-3 스키마와 완전 호환
// 기반: infrastructure/database/schemas/postgresql-schema.sql

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Device, DeviceGroup, DeviceStatusHistory, User } from '../entities';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  database: process.env.POSTGRES_DB || 'automation',
  ssl: process.env.POSTGRES_SSL === 'true',
  synchronize: process.env.NODE_ENV === 'development', // PROD에서는 false
  logging: process.env.NODE_ENV === 'development',
  entities: [
    Device,
    DeviceGroup,
    DeviceStatusHistory,
    User
  ],
  migrations: [
    'src/migrations/*.ts'
  ],
  subscribers: [
    'src/subscribers/*.ts'
  ],
  // Connection Pool 설정
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  // 성능 최적화
  cache: {
    duration: 30000, // 30초
  }
});

// 데이터베이스 연결 초기화
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ PostgreSQL 연결 성공');
    }
  } catch (error) {
    console.error('❌ PostgreSQL 연결 실패:', error);
    throw error;
  }
};

// 데이터베이스 연결 종료
export const closeDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ PostgreSQL 연결 종료');
    }
  } catch (error) {
    console.error('❌ PostgreSQL 연결 종료 실패:', error);
    throw error;
  }
};

// Health Check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await AppDataSource.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL Health Check 실패:', error);
    return false;
  }
};

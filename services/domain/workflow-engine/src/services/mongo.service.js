const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');
const config = require('../config');

class MongoService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.MONGODB_URL, {
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db(config.MONGODB_DB_NAME);
      this.isConnected = true;
      
      logger.info('✅ MongoDB 연결 성공');
      
      // 인덱스 생성
      await this.createIndexes();
      
    } catch (error) {
      logger.error('❌ MongoDB 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        logger.info('🔌 MongoDB 연결 해제');
      }
    } catch (error) {
      logger.error('❌ MongoDB 연결 해제 실패:', error);
    }
  }

  async createIndexes() {
    try {
      // n8n 워크플로우 데이터 컬렉션 인덱스
      await this.db.collection('n8n_workflow_data').createIndex({ workflowId: 1 });
      await this.db.collection('n8n_workflow_data').createIndex({ executionId: 1 });
      await this.db.collection('n8n_workflow_data').createIndex({ createdAt: 1 });

      // 워크플로우 실행 로그 컬렉션 인덱스
      await this.db.collection('workflow_execution_logs').createIndex({ executionId: 1 });
      await this.db.collection('workflow_execution_logs').createIndex({ timestamp: 1 });
      await this.db.collection('workflow_execution_logs').createIndex({ level: 1 });

      logger.info('✅ MongoDB 인덱스 생성 완료');
    } catch (error) {
      logger.error('❌ MongoDB 인덱스 생성 실패:', error);
    }
  }

  async healthCheck() {
    try {
      await this.db.admin().ping();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('❌ MongoDB 헬스체크 실패:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  getDb() {
    if (!this.isConnected) {
      throw new Error('MongoDB is not connected. Call connect() first.');
    }
    return this.db;
  }

  // n8n 워크플로우 데이터 저장
  async saveN8nData(workflowId, executionId, data) {
    try {
      const collection = this.db.collection('n8n_workflow_data');
      const document = {
        workflowId,
        executionId,
        data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(document);
      logger.debug(`n8n 데이터 저장 완료: ${result.insertedId}`);
      return result.insertedId;
    } catch (error) {
      logger.error('❌ n8n 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 워크플로우 실행 로그 저장
  async saveExecutionLog(executionId, level, message, metadata = {}) {
    try {
      const collection = this.db.collection('workflow_execution_logs');
      const document = {
        executionId,
        level,
        message,
        metadata,
        timestamp: new Date()
      };

      await collection.insertOne(document);
      logger.debug(`실행 로그 저장 완료: ${executionId}`);
    } catch (error) {
      logger.error('❌ 실행 로그 저장 실패:', error);
      throw error;
    }
  }

  // 실행 로그 조회
  async getExecutionLogs(executionId, limit = 100) {
    try {
      const collection = this.db.collection('workflow_execution_logs');
      const logs = await collection
        .find({ executionId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return logs;
    } catch (error) {
      logger.error('❌ 실행 로그 조회 실패:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
const mongoService = new MongoService();

module.exports = mongoService;
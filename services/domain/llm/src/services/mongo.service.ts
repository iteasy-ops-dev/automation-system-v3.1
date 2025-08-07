/**
 * MongoDB Service - 프롬프트 템플릿 및 로그 관리
 * 계약 준수: TASK-3 MongoDB 스키마 100% 준수
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { finalConfig } from '../config';
import logger from '../utils/logger';
import { PromptTemplate, LLMRequestLog } from '../types/contracts';

export class MongoService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  
  // 컬렉션 참조
  private promptTemplatesCollection: Collection<PromptTemplate> | null = null;
  private llmRequestLogsCollection: Collection<LLMRequestLog> | null = null;

  /**
   * MongoDB 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(finalConfig.databases.mongodb.url, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db(finalConfig.databases.mongodb.database);
      
      // 컬렉션 참조 설정
      this.promptTemplatesCollection = this.db.collection<PromptTemplate>('prompt_templates');
      this.llmRequestLogsCollection = this.db.collection<LLMRequestLog>('llm_request_logs');
      
      // 인덱스 생성
      await this.createIndexes();
      
      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * 필수 인덱스 생성
   */
  private async createIndexes(): Promise<void> {
    try {
      // 프롬프트 템플릿 인덱스
      await this.promptTemplatesCollection?.createIndex({ templateId: 1 }, { unique: true });
      await this.promptTemplatesCollection?.createIndex({ name: 1 });
      await this.promptTemplatesCollection?.createIndex({ category: 1 });
      await this.promptTemplatesCollection?.createIndex({ isActive: 1 });
      await this.promptTemplatesCollection?.createIndex({ createdAt: -1 });
      
      // LLM 요청 로그 인덱스
      await this.llmRequestLogsCollection?.createIndex({ requestId: 1 }, { unique: true });
      await this.llmRequestLogsCollection?.createIndex({ timestamp: -1 });
      await this.llmRequestLogsCollection?.createIndex({ provider: 1, timestamp: -1 });
      await this.llmRequestLogsCollection?.createIndex({ templateUsed: 1 });
      await this.llmRequestLogsCollection?.createIndex({ status: 1 });

      logger.info('MongoDB indexes created successfully');
    } catch (error) {
      logger.error('Failed to create MongoDB indexes:', error);
      throw error;
    }
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      logger.info('MongoDB disconnected');
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('MongoDB health check failed:', error);
      return false;
    }
  }

  // ===== 프롬프트 템플릿 관리 =====

  /**
   * 템플릿 생성
   */
  async createTemplate(template: PromptTemplate): Promise<PromptTemplate> {
    try {
      if (!this.promptTemplatesCollection) {
        throw new Error('MongoDB not connected');
      }

      await this.promptTemplatesCollection.insertOne(template);
      logger.info('Template created:', { templateId: template.templateId });
      return template;
    } catch (error) {
      logger.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * 템플릿 조회 (ID)
   */
  async getTemplate(templateId: string): Promise<PromptTemplate | null> {
    try {
      if (!this.promptTemplatesCollection) {
        throw new Error('MongoDB not connected');
      }

      return await this.promptTemplatesCollection.findOne({ templateId });
    } catch (error) {
      logger.error('Failed to get template:', error);
      throw error;
    }
  }

  /**
   * 템플릿 목록 조회
   */
  async getTemplates(filters: {
    category?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PromptTemplate[]; total: number }> {
    try {
      if (!this.promptTemplatesCollection) {
        throw new Error('MongoDB not connected');
      }

      const query: any = {};
      
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { content: { $regex: filters.search, $options: 'i' } },
        ];
      }

      const total = await this.promptTemplatesCollection.countDocuments(query);
      const items = await this.promptTemplatesCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 20)
        .toArray();

      return { items, total };
    } catch (error) {
      logger.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * 템플릿 사용량 증가
   */
  async incrementTemplateUsage(templateId: string): Promise<void> {
    try {
      if (!this.promptTemplatesCollection) {
        throw new Error('MongoDB not connected');
      }

      await this.promptTemplatesCollection.updateOne(
        { templateId },
        { 
          $inc: { usageCount: 1 },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (error) {
      logger.error('Failed to increment template usage:', error);
      throw error;
    }
  }

  // ===== LLM 요청 로그 관리 =====

  /**
   * 요청 로그 저장
   */
  async saveRequestLog(log: LLMRequestLog): Promise<void> {
    try {
      if (!this.llmRequestLogsCollection) {
        throw new Error('MongoDB not connected');
      }

      await this.llmRequestLogsCollection.insertOne(log);
      logger.debug('Request log saved:', { requestId: log.requestId });
    } catch (error) {
      logger.error('Failed to save request log:', error);
      throw error;
    }
  }

  /**
   * 요청 로그 조회
   */
  async getRequestLog(requestId: string): Promise<LLMRequestLog | null> {
    try {
      if (!this.llmRequestLogsCollection) {
        throw new Error('MongoDB not connected');
      }

      return await this.llmRequestLogsCollection.findOne({ requestId });
    } catch (error) {
      logger.error('Failed to get request log:', error);
      throw error;
    }
  }

  /**
   * 요청 로그 통계
   */
  async getRequestStats(filters: {
    provider?: string;
    model?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalRequests: number;
    successRate: number;
    avgDuration: number;
  }> {
    try {
      if (!this.llmRequestLogsCollection) {
        throw new Error('MongoDB not connected');
      }

      const matchStage: any = {};
      
      if (filters.provider) matchStage.provider = filters.provider;
      if (filters.model) matchStage.model = filters.model;
      if (filters.status) matchStage.status = filters.status;
      if (filters.startDate || filters.endDate) {
        matchStage.timestamp = {};
        if (filters.startDate) matchStage.timestamp.$gte = filters.startDate;
        if (filters.endDate) matchStage.timestamp.$lte = filters.endDate;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
            },
            avgDuration: { $avg: '$duration' },
          }
        }
      ];

      const result = await this.llmRequestLogsCollection.aggregate(pipeline).toArray();
      
      if (result.length === 0) {
        return { totalRequests: 0, successRate: 0, avgDuration: 0 };
      }

      const stats = result[0];
      return {
        totalRequests: stats.totalRequests,
        successRate: stats.totalRequests > 0 ? (stats.successCount / stats.totalRequests) * 100 : 0,
        avgDuration: stats.avgDuration || 0,
      };
    } catch (error) {
      logger.error('Failed to get request stats:', error);
      throw error;
    }
  }

  /**
   * 요청 로그 조회 (사용량 통계용)
   */
  async getRequestLogs(filters: {
    providerId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<LLMRequestLog[]> {
    try {
      if (!this.llmRequestLogsCollection) {
        throw new Error('MongoDB not connected');
      }

      const query: any = {};
      
      if (filters.providerId) {
        query.providerId = filters.providerId;
      }
      
      if (filters.startDate && filters.endDate) {
        query.timestamp = {
          $gte: filters.startDate,
          $lte: filters.endDate
        };
      }
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      return await this.llmRequestLogsCollection
        .find(query)
        .sort({ timestamp: -1 })
        .toArray();
    } catch (error) {
      logger.error('Failed to get request logs:', error);
      throw error;
    }
  }
}

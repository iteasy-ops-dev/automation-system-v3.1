/**
 * Provider Repository - MongoDB 기반 Provider 관리
 * 계약 준수: llm-service.yaml 100% 준수
 */

import { Db, Collection, ObjectId, WithId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { encrypt, decrypt } from '../utils/crypto';
import {
  LLMProvider,
  CreateProviderDto,
  UpdateProviderDto,
  LLMPurpose
} from '../types/provider.types';

// MongoDB 문서 타입
interface ProviderDocument extends Omit<LLMProvider, 'config'> {
  _id?: ObjectId;
  config: {
    apiKeyEncrypted?: string; // API 키는 암호화하여 저장
    baseUrl?: string;
    apiVersion?: string;
    organization?: string;
    authType?: 'bearer' | 'basic' | 'custom' | 'none';
    customHeaders?: Record<string, string>;
    timeout?: number;
  };
}

export class ProviderRepository {
  private collection: Collection<ProviderDocument>;

  constructor(private db: Db) {
    this.collection = db.collection<ProviderDocument>('llm_providers');
    this.ensureIndexes();
    logger.info('ProviderRepository initialized with MongoDB');
  }

  /**
   * 인덱스 생성
   */
  private async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ id: 1 }, { unique: true });
      await this.collection.createIndex({ name: 1 });
      await this.collection.createIndex({ type: 1 });
      await this.collection.createIndex({ purpose: 1 });
      await this.collection.createIndex({ isActive: 1 });
      await this.collection.createIndex({ 'isDefault.forChat': 1 });
      await this.collection.createIndex({ 'isDefault.forWorkflow': 1 });
      await this.collection.createIndex({ createdAt: -1 });
      
      logger.info('Provider indexes created successfully');
    } catch (error) {
      logger.error('Failed to create provider indexes:', error);
    }
  }

  /**
   * 모든 Provider 조회
   */
  async findAll(): Promise<LLMProvider[]> {
    try {
      const documents = await this.collection.find({}).toArray();
      return documents.map(doc => this.documentToProvider(doc));
    } catch (error) {
      logger.error('Failed to find all providers:', error);
      throw error;
    }
  }

  /**
   * ID로 Provider 조회
   */
  async findById(id: string): Promise<LLMProvider | null> {
    try {
      const document = await this.collection.findOne({ id });
      return document ? this.documentToProvider(document) : null;
    } catch (error) {
      logger.error(`Failed to find provider by id ${id}:`, error);
      throw error;
    }
  }

  /**
   * 용도별 Provider 조회
   */
  async findByPurpose(purpose: LLMPurpose): Promise<LLMProvider[]> {
    try {
      const query: any = purpose === 'both' 
        ? {} 
        : { $or: [{ purpose: purpose as string }, { purpose: 'both' }] };
      
      const documents = await this.collection.find(query).toArray();
      return documents.map(doc => this.documentToProvider(doc));
    } catch (error) {
      logger.error(`Failed to find providers by purpose ${purpose}:`, error);
      throw error;
    }
  }

  /**
   * 기본 Provider 조회
   */
  async findDefault(purpose: 'chat' | 'workflow'): Promise<LLMProvider | null> {
    try {
      const query = purpose === 'chat' 
        ? { 'isDefault.forChat': true }
        : { 'isDefault.forWorkflow': true };
      
      const document = await this.collection.findOne(query);
      return document ? this.documentToProvider(document) : null;
    } catch (error) {
      logger.error(`Failed to find default provider for ${purpose}:`, error);
      throw error;
    }
  }

  /**
   * Provider 생성
   */
  async create(dto: CreateProviderDto): Promise<LLMProvider> {
    try {
      const provider: LLMProvider = {
        id: `${dto.type}-${uuidv4().substring(0, 8)}`,
        name: dto.name,
        type: dto.type,
        purpose: dto.purpose,
        config: dto.config,
        models: dto.models || [],
        isActive: true,
        isDefault: {
          forChat: false,
          forWorkflow: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const document = this.providerToDocument(provider);
      await this.collection.insertOne(document);
      
      logger.info(`Provider created: ${provider.id}`);
      return provider;
    } catch (error) {
      logger.error('Failed to create provider:', error);
      throw error;
    }
  }

  /**
   * Provider 수정
   */
  async update(id: string, updates: UpdateProviderDto): Promise<LLMProvider> {
    try {
      const updateDoc: any = {
        $set: {
          updatedAt: new Date()
        }
      };

      if (updates.name !== undefined) {
        updateDoc.$set.name = updates.name;
      }

      if (updates.purpose !== undefined) {
        updateDoc.$set.purpose = updates.purpose;
      }

      if (updates.config !== undefined) {
        // API 키가 있으면 암호화
        if (updates.config.apiKey !== undefined) {
          updateDoc.$set['config.apiKeyEncrypted'] = encrypt(updates.config.apiKey);
          delete updates.config.apiKey;
        }
        
        // 다른 config 필드들 업데이트
        Object.entries(updates.config).forEach(([key, value]) => {
          updateDoc.$set[`config.${key}`] = value;
        });
      }

      if (updates.isActive !== undefined) {
        updateDoc.$set.isActive = updates.isActive;
      }

      if (updates.models !== undefined) {
        updateDoc.$set.models = updates.models;
      }

      if (updates.isDefault !== undefined) {
        if (updates.isDefault.forChat !== undefined) {
          updateDoc.$set['isDefault.forChat'] = updates.isDefault.forChat;
        }
        if (updates.isDefault.forWorkflow !== undefined) {
          updateDoc.$set['isDefault.forWorkflow'] = updates.isDefault.forWorkflow;
        }
      }

      const result = await this.collection.findOneAndUpdate(
        { id },
        updateDoc,
        { returnDocument: 'after' }
      );

      if (!result || !result.value) {
        throw new Error(`Provider not found: ${id}`);
      }

      logger.info(`Provider updated: ${id}`);
      return this.documentToProvider(result.value);
    } catch (error) {
      logger.error(`Failed to update provider ${id}:`, error);
      throw error;
    }
  }

  /**
   * Provider 삭제
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ id });
      const success = result.deletedCount > 0;
      
      if (success) {
        logger.info(`Provider deleted: ${id}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Failed to delete provider ${id}:`, error);
      throw error;
    }
  }

  /**
   * 기본 Provider 설정
   */
  async setDefault(id: string, purpose: LLMPurpose): Promise<void> {
    try {
      // 트랜잭션이 필요하지만 단순화를 위해 순차 처리
      // 1. 기존 기본 프로바이더 해제
      if (purpose === 'chat' || purpose === 'both') {
        await this.collection.updateMany(
          { 'isDefault.forChat': true },
          { $set: { 'isDefault.forChat': false } }
        );
      }
      
      if (purpose === 'workflow' || purpose === 'both') {
        await this.collection.updateMany(
          { 'isDefault.forWorkflow': true },
          { $set: { 'isDefault.forWorkflow': false } }
        );
      }

      // 2. 새 기본 프로바이더 설정
      const updateDoc: any = { $set: {} };
      
      if (purpose === 'chat' || purpose === 'both') {
        updateDoc.$set['isDefault.forChat'] = true;
      }
      
      if (purpose === 'workflow' || purpose === 'both') {
        updateDoc.$set['isDefault.forWorkflow'] = true;
      }

      await this.collection.updateOne({ id }, updateDoc);
      
      logger.info(`Default provider set: ${id} for ${purpose}`);
    } catch (error) {
      logger.error(`Failed to set default provider ${id}:`, error);
      throw error;
    }
  }

  /**
   * 초기 데이터 설정
   */
  async initializeDefaults(): Promise<void> {
    try {
      const count = await this.collection.countDocuments();
      
      // 이미 데이터가 있으면 스킵
      if (count > 0) {
        logger.info('Providers already initialized');
        return;
      }

      // 환경변수에서 API 키 확인
      const openaiKey = process.env.OPENAI_API_KEY;
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      
      logger.info('Initializing default providers...', {
        hasOpenAI: !!openaiKey,
        hasAnthropic: !!anthropicKey
      });

      // OpenAI 기본 Provider 생성
      if (openaiKey) {
        await this.create({
          name: 'OpenAI (Default)',
          type: 'openai',
          purpose: 'both',
          config: {
            apiKey: openaiKey,
            baseUrl: 'https://api.openai.com/v1',
          },
          models: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-turbo-preview']
        });

        // 기본값으로 설정
        const provider = await this.collection.findOne({ type: 'openai' });
        if (provider) {
          await this.setDefault(provider.id, 'both');
        }
      }

      // Anthropic Provider 생성
      if (anthropicKey) {
        await this.create({
          name: 'Anthropic',
          type: 'anthropic',
          purpose: 'both',
          config: {
            apiKey: anthropicKey,
            baseUrl: 'https://api.anthropic.com',
          },
          models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
        });
      }

      logger.info('Default providers initialized');
    } catch (error) {
      logger.error('Failed to initialize default providers:', error);
    }
  }

  /**
   * Document를 Provider로 변환
   */
  private documentToProvider(doc: WithId<ProviderDocument>): LLMProvider {
    const provider: LLMProvider = {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      purpose: doc.purpose,
      config: {
        baseUrl: doc.config.baseUrl,
        apiVersion: doc.config.apiVersion,
        organization: doc.config.organization,
        authType: doc.config.authType,
        customHeaders: doc.config.customHeaders,
        timeout: doc.config.timeout,
      },
      models: doc.models,
      isActive: doc.isActive,
      isDefault: doc.isDefault,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };

    // API 키 복호화
    if (doc.config.apiKeyEncrypted) {
      provider.config.apiKey = decrypt(doc.config.apiKeyEncrypted);
    }

    return provider;
  }

  /**
   * Provider를 Document로 변환
   */
  private providerToDocument(provider: LLMProvider): ProviderDocument {
    const doc: ProviderDocument = {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      purpose: provider.purpose,
      config: {
        baseUrl: provider.config.baseUrl,
        apiVersion: provider.config.apiVersion,
        organization: provider.config.organization,
        authType: provider.config.authType,
        customHeaders: provider.config.customHeaders,
        timeout: provider.config.timeout,
      },
      models: provider.models,
      isActive: provider.isActive,
      isDefault: provider.isDefault,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt
    };

    // API 키 암호화
    if (provider.config.apiKey) {
      doc.config.apiKeyEncrypted = encrypt(provider.config.apiKey);
    }

    return doc;
  }
}

/**
 * LLM Service - 핵심 비즈니스 로직 (계속)
 * 계약 준수: shared/contracts/v1.0/rest/domain/llm-service.yaml 100% 준수
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { CacheService } from './cache.service';
import { EventService } from './event.service';
import { MongoService } from './mongo.service';
import { PostgresService } from './postgres.service';
import { ProviderService } from './provider.service';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { BaseLLMProvider } from '../providers/base.provider';
import { finalConfig } from '../config';
import {
  ChatRequest,
  ChatResponse,
  ModelInfo,
  UsageResponse,
  Template,
  TemplateCreate,
  TemplatesResponse,
  LLMProvider,
  HealthStatus,
  LLMRequestLog,
  TokenUsage,
  PromptTemplate,
} from '../types/contracts';
import { LLMProvider as Provider } from '../types/provider.types';

export class LLMService {
  private providers: Map<string, BaseLLMProvider> = new Map();
  private cacheService: CacheService;
  private eventService: EventService;
  private mongoService: MongoService;
  private postgresService: PostgresService;
  private providerService: ProviderService;

  constructor(
    cacheService: CacheService,
    eventService: EventService,
    mongoService: MongoService,
    postgresService: PostgresService,
    providerService: ProviderService
  ) {
    this.cacheService = cacheService;
    this.eventService = eventService;
    this.mongoService = mongoService;
    this.postgresService = postgresService;
    this.providerService = providerService;
    
    this.initializeProviders();
  }

  /**
   * LLM 프로바이더 초기화
   */
  async initializeProviders(): Promise<void> {
    try {
      // MongoDB에서 활성 Provider 조회
      const providers = await this.providerService.getAllProviders();
      
      for (const provider of providers) {
        if (!provider.isActive) continue;
        
        try {
          switch (provider.type) {
            case 'openai':
              this.providers.set(provider.id, new OpenAIProvider(provider.config));
              logger.info(`OpenAI provider initialized: ${provider.name} (${provider.id})`);
              break;
            case 'anthropic':
              this.providers.set(provider.id, new AnthropicProvider(provider.config));
              logger.info(`Anthropic provider initialized: ${provider.name} (${provider.id})`);
              break;
            default:
              logger.warn(`Unknown provider type: ${provider.type}`);
          }
        } catch (error) {
          logger.error(`Failed to initialize provider ${provider.name}:`, error);
        }
      }

      logger.info(`Initialized ${this.providers.size} LLM providers from database`);
      
      // Provider 변경 감지 및 자동 리로드 설정
      this.setupProviderReload();
    } catch (error) {
      logger.error('Failed to initialize providers:', error);
      // 환경변수 기반 폴백
      this.initializeProvidersFromEnv();
    }
  }

  /**
   * 환경변수 기반 프로바이더 초기화 (폴백)
   */
  private initializeProvidersFromEnv(): void {
    try {
      // OpenAI 프로바이더 초기화
      if (finalConfig.providers.find(p => p.providerType === 'openai')?.apiKeyHash) {
        this.providers.set('env-openai', new OpenAIProvider());
        logger.info('OpenAI provider initialized from environment');
      }

      // Anthropic 프로바이더 초기화
      if (finalConfig.providers.find(p => p.providerType === 'anthropic')?.apiKeyHash) {
        this.providers.set('env-anthropic', new AnthropicProvider());
        logger.info('Anthropic provider initialized from environment');
      }
    } catch (error) {
      logger.error('Failed to initialize providers from environment:', error);
    }
  }

  /**
   * Provider 변경 감지 설정
   */
  private setupProviderReload(): void {
    // 30초마다 Provider 변경사항 확인
    setInterval(async () => {
      try {
        await this.reloadProviders();
      } catch (error) {
        logger.error('Failed to reload providers:', error);
      }
    }, 30000);
  }

  /**
   * Provider 재로드
   */
  private async reloadProviders(): Promise<void> {
    const providers = await this.providerService.getAllProviders();
    const currentIds = new Set(this.providers.keys());
    const newIds = new Set(providers.filter(p => p.isActive).map(p => p.id));
    
    // 제거된 Provider 처리
    for (const id of currentIds) {
      if (!newIds.has(id) && !id.startsWith('env-')) {
        this.providers.delete(id);
        logger.info(`Provider removed: ${id}`);
      }
    }
    
    // 추가/수정된 Provider 처리
    for (const provider of providers) {
      if (!provider.isActive) continue;
      
      if (!currentIds.has(provider.id)) {
        // 새로운 Provider
        try {
          switch (provider.type) {
            case 'openai':
              this.providers.set(provider.id, new OpenAIProvider(provider.config));
              logger.info(`Provider added: ${provider.name} (${provider.id})`);
              break;
            case 'anthropic':
              this.providers.set(provider.id, new AnthropicProvider(provider.config));
              logger.info(`Provider added: ${provider.name} (${provider.id})`);
              break;
          }
        } catch (error) {
          logger.error(`Failed to add provider ${provider.name}:`, error);
        }
      }
    }
  }

  /**
   * 채팅 요청 처리 - 계약 준수 메인 메서드
   */
  async chat(request: ChatRequest & { providerId?: string }): Promise<ChatResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      // 1. Provider 선택 (요청에 providerId가 있으면 사용, 없으면 기본값)
      let provider: Provider | null = null;
      let llmProvider: BaseLLMProvider | undefined;
      
      if (request.providerId) {
        provider = await this.providerService.getProviderById(request.providerId);
      } else {
        provider = await this.providerService.getDefaultProvider('chat');
      }
      
      if (!provider || !provider.isActive) {
        // 환경변수 기반 폴백
        const providerType = request.model ? this.getProviderForModel(request.model) : 'openai';
        llmProvider = this.providers.get(`env-${providerType}`);
        
        if (!llmProvider) {
          throw new Error('No provider available for chat request');
        }
      } else {
        llmProvider = this.providers.get(provider.id);
        
        if (!llmProvider) {
          // Provider가 아직 초기화되지 않았다면 즉시 초기화
          await this.reloadProviders();
          llmProvider = this.providers.get(provider.id);
          
          if (!llmProvider) {
            throw new Error(`Provider ${provider.name} is not initialized`);
          }
        }
      }

      // 2. 요청 시작 이벤트 발행
      await this.eventService.publishRequestStarted({
        requestId,
        provider: provider?.type || llmProvider.getProviderType(),
        model: request.model || provider?.models[0] || 'gpt-3.5-turbo',
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      // 3. 캐시 확인
      const cacheKey = await this.generateCacheKey(request.messages);
      const cachedResponse = await this.cacheService.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        await this.eventService.publishCacheHit({
          requestId,
          cacheKey,
          similarity: 1.0,
          timeSaved: Date.now() - startTime,
        });
        
        return {
          ...cachedResponse,
          id: requestId,
        };
      }

      // 4. LLM Provider를 통해 요청 실행
      const response = await llmProvider.chat(request);

      // 5. 사용량 로깅
      await this.logUsage({
        requestId,
        providerId: provider?.id || `env-${llmProvider.getProviderType()}`,
        modelName: response.model,
        usage: response.usage,
        duration: Date.now() - startTime,
        status: 'success',
      });

      // 6. 요청 로그 저장 (MongoDB에 실제 사용량 기록)
      const providerTypeMap: Record<string, LLMProvider> = {
        'openai': 'openai',
        'anthropic': 'anthropic',
        'google': 'google',
        'azure': 'azure'
      };
      
      await this.saveRequestLog({
        requestId,
        timestamp: new Date(),
        provider: (provider?.type && providerTypeMap[provider.type]) || llmProvider.getProviderType(),
        providerId: provider?.id,
        model: response.model,
        messages: request.messages,
        response: {
          content: response.choices[0]?.message.content || '',
          finishReason: response.finishReason || 'stop',
          tokenUsage: response.usage,
        },
        cached: false,
        duration: Date.now() - startTime,
        status: 'success',
      });

      // 6. 캐시 저장
      await this.cacheService.setCachedResponse(cacheKey, response, finalConfig.cache.ttl);

      // 7. 완료 이벤트 발행
      await this.eventService.publishRequestCompleted({
        requestId,
        provider: (provider?.type && providerTypeMap[provider.type]) || llmProvider.getProviderType(),
        model: response.model,
        usage: response.usage,
        duration: Date.now() - startTime,
        finishReason: response.finishReason || 'stop',
        cached: false,
      });

      return {
        ...response,
        id: requestId,
      };

    } catch (error) {
      // 에러 로깅 및 이벤트 발행
      await this.eventService.publishRequestFailed({
        requestId,
        provider: request.model ? this.getProviderForModel(request.model) : 'openai',
        model: request.model || 'gpt-3.5-turbo',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      logger.error('Chat request failed:', { requestId, error });
      throw error;
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async getModels(provider?: LLMProvider): Promise<ModelInfo[]> {
    try {
      const models: ModelInfo[] = [];
      
      for (const [providerType, providerInstance] of this.providers) {
        if (!provider || provider === providerType) {
          const providerModels = await providerInstance.getModels();
          models.push(...providerModels);
        }
      }

      return models;
    } catch (error) {
      logger.error('Failed to get models:', error);
      throw error;
    }
  }

  /**
   * 사용량 통계 조회
   */
  async getUsage(filters: {
    start?: string;
    end?: string;
    provider?: string;
    model?: string;
    groupBy?: 'provider' | 'model' | 'user' | 'hour' | 'day';
  }): Promise<UsageResponse> {
    try {
      const startDate = filters.start ? new Date(filters.start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = filters.end ? new Date(filters.end) : new Date();

      return await this.postgresService.getUsageStats({
        startDate,
        endDate,
        provider: filters.provider,
        model: filters.model,
        groupBy: filters.groupBy || 'day',
      });
    } catch (error) {
      logger.error('Failed to get usage:', error);
      throw error;
    }
  }

  /**
   * 프롬프트 템플릿 목록 조회
   */
  async getTemplates(filters: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<TemplatesResponse> {
    try {
      const result = await this.mongoService.getTemplates({
        ...filters,
        isActive: true,
      });

      return {
        items: result.items.map(this.mapPromptTemplateToTemplate),
        total: result.total,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
      };
    } catch (error) {
      logger.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * 프롬프트 템플릿 생성
   */
  async createTemplate(templateData: TemplateCreate): Promise<Template> {
    try {
      const templateId = uuidv4();
      const now = new Date();

      const promptTemplate: PromptTemplate = {
        templateId,
        name: templateData.name,
        content: templateData.template,
        category: templateData.category,
        variables: this.extractVariables(templateData.template),
        version: '1.0.0',
        isActive: true,
        usageCount: 0,
        createdBy: 'system', // TODO: 실제 사용자 ID로 변경
        createdAt: now,
        updatedAt: now,
      };

      await this.mongoService.createTemplate(promptTemplate);

      return this.mapPromptTemplateToTemplate(promptTemplate);
    } catch (error) {
      logger.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const checks = await Promise.allSettled([
        this.postgresService.healthCheck(),
        this.mongoService.healthCheck(),
        this.cacheService.healthCheck(),
        this.eventService.healthCheck(),
      ]);

      const [postgres, mongo, redis, kafka] = checks.map(result => 
        result.status === 'fulfilled' ? result.value : false
      );

      const availableProviders = Array.from(this.providers.keys());
      
      const status = postgres && mongo && redis && kafka ? 'healthy' : 
                   (postgres || mongo) && redis ? 'degraded' : 'unhealthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        services: {
          postgres: {
            status: postgres ? 'up' : 'down',
            lastCheck: new Date().toISOString(),
          },
          mongodb: {
            status: mongo ? 'up' : 'down',
            lastCheck: new Date().toISOString(),
          },
          redis: {
            status: redis ? 'up' : 'down',
            lastCheck: new Date().toISOString(),
          },
          kafka: {
            status: kafka ? 'up' : 'down',
            lastCheck: new Date().toISOString(),
          },
        },
        providers: {
          available: availableProviders,
          count: availableProviders.length,
        },
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          postgres: { status: 'down', lastCheck: new Date().toISOString() },
          mongodb: { status: 'down', lastCheck: new Date().toISOString() },
          redis: { status: 'down', lastCheck: new Date().toISOString() },
          kafka: { status: 'down', lastCheck: new Date().toISOString() },
        },
        providers: {
          available: [],
          count: 0,
        },
      };
    }
  }

  // ===== 내부 유틸리티 메서드 =====

  /**
   * 캐시 키 생성
   */
  private async generateCacheKey(messages: any[]): Promise<string> {
    const normalized = JSON.stringify(messages, Object.keys(messages).sort());
    return await this.cacheService.generatePromptHash(normalized);
  }

  /**
   * 프로바이더 선택 로직
   */
  private selectProvider(model?: string): BaseLLMProvider {
    if (model) {
      const providerType = this.getProviderForModel(model);
      const provider = this.providers.get(providerType);
      if (provider) return provider;
    }

    // 기본 프로바이더 반환 (우선순위: OpenAI > Anthropic)
    return this.providers.get('openai') || this.providers.get('anthropic') || 
           Array.from(this.providers.values())[0];
  }

  /**
   * 모델에 따른 프로바이더 결정
   */
  private getProviderForModel(model: string): LLMProvider {
    if (model.startsWith('gpt-') || model.includes('openai')) return 'openai';
    if (model.startsWith('claude-') || model.includes('anthropic')) return 'anthropic';
    return 'openai'; // 기본값
  }

  /**
   * 프로바이더 타입에 따른 ID 조회
   */
  private getProviderIdForType(providerType: LLMProvider): string {
    const config = finalConfig.providers.find(p => p.providerType === providerType);
    return config?.id || `${providerType}-provider`;
  }

  /**
   * 사용량 로깅
   */
  private async logUsage(logData: {
    requestId: string;
    providerId: string;
    modelName: string;
    usage: TokenUsage;
    duration: number;
    status: 'success' | 'error' | 'timeout';
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.postgresService.logUsage({
        id: uuidv4(),
        requestId: logData.requestId,
        providerId: logData.providerId,
        modelName: logData.modelName,
        promptTokens: logData.usage.promptTokens,
        completionTokens: logData.usage.completionTokens,
        totalTokens: logData.usage.totalTokens,
        cost: logData.usage.cost || 0,
        duration: logData.duration,
        status: logData.status,
        errorMessage: logData.errorMessage,
        cached: false,
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to log usage:', error);
    }
  }

  /**
   * 요청 로그 저장
   */
  private async saveRequestLog(log: LLMRequestLog): Promise<void> {
    try {
      await this.mongoService.saveRequestLog(log);
    } catch (error) {
      logger.error('Failed to save request log:', error);
    }
  }

  /**
   * 템플릿 변수 추출
   */
  private extractVariables(template: string): any[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    
    return matches.map(match => {
      const name = match.replace(/\{\{|\}\}/g, '');
      return {
        name,
        type: 'string',
        required: true,
        description: `Variable: ${name}`,
      };
    });
  }

  /**
   * PromptTemplate을 Template으로 매핑
   */
  private mapPromptTemplateToTemplate(promptTemplate: PromptTemplate): Template {
    return {
      id: promptTemplate.templateId,
      name: promptTemplate.name,
      category: promptTemplate.category,
      template: promptTemplate.content,
      variables: promptTemplate.variables.map(v => v.name),
      description: `Template for ${promptTemplate.category}`,
      createdAt: promptTemplate.createdAt.toISOString(),
      updatedAt: promptTemplate.updatedAt.toISOString(),
    };
  }
}

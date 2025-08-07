/**
 * Event Service - Kafka 이벤트 발행
 * 계약 준수: shared/contracts/v1.0/events/llm-events.json 100% 준수
 */

import { Kafka, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { finalConfig } from '../config';
import logger from '../utils/logger';
import { LLMEvent } from '../types/contracts';

export class EventService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: finalConfig.kafka.clientId,
      brokers: finalConfig.kafka.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
    
    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });
  }

  /**
   * Kafka 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      if (!this.producer) {
        throw new Error('Producer not initialized');
      }

      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka event service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Kafka:', error);
      throw error;
    }
  }

  /**
   * Kafka 연결 종료
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info('Kafka event service disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting from Kafka:', error);
    }
  }

  /**
   * 이벤트 발행
   */
  async publishEvent(event: LLMEvent): Promise<void> {
    try {
      if (!this.producer || !this.isConnected) {
        throw new Error('Kafka producer not connected');
      }

      await this.producer.send({
        topic: 'llm-events',
        messages: [
          {
            key: event.requestId || event.eventId,
            value: JSON.stringify(event),
            timestamp: new Date().getTime().toString(),
          },
        ],
      });

      logger.debug('Event published:', { 
        eventType: event.eventType, 
        eventId: event.eventId 
      });
    } catch (error) {
      logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      return this.isConnected;
    } catch (error) {
      logger.error('Kafka health check failed:', error);
      return false;
    }
  }

  /**
   * 요청 시작 이벤트 발행
   */
  async publishRequestStarted(data: {
    requestId: string;
    provider: string;
    model: string;
    messages: any[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<void> {
    try {
      const event: LLMEvent = {
        eventId: uuidv4(),
        eventType: 'LLMRequestStarted',
        timestamp: new Date().toISOString(),
        requestId: data.requestId,
        payload: {
          provider: data.provider,
          model: data.model,
          requestType: 'chat',
          inputTokens: this.estimateTokens(JSON.stringify(data.messages)),
          maxTokens: data.maxTokens,
          temperature: data.temperature,
          stream: false,
        },
        metadata: {
          source: 'llm-service',
          version: '1.0.0',
        },
      };

      await this.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish request started event:', error);
    }
  }

  /**
   * 요청 완료 이벤트 발행
   */
  async publishRequestCompleted(data: {
    requestId: string;
    provider: string;
    model: string;
    usage: any;
    duration: number;
    finishReason: string;
    cached: boolean;
  }): Promise<void> {
    try {
      const event: LLMEvent = {
        eventId: uuidv4(),
        eventType: 'LLMRequestCompleted',
        timestamp: new Date().toISOString(),
        requestId: data.requestId,
        payload: {
          provider: data.provider,
          model: data.model,
          requestType: 'chat',
          tokenUsage: data.usage,
          duration: data.duration,
          finishReason: data.finishReason,
          responseLength: 0,
          cacheUsed: data.cached,
        },
        metadata: {
          source: 'llm-service',
          version: '1.0.0',
        },
      };

      await this.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish request completed event:', error);
    }
  }

  /**
   * 요청 실패 이벤트 발행
   */
  async publishRequestFailed(data: {
    requestId: string;
    provider: string;
    model: string;
    error: string;
    duration: number;
  }): Promise<void> {
    try {
      const event: LLMEvent = {
        eventId: uuidv4(),
        eventType: 'LLMRequestFailed',
        timestamp: new Date().toISOString(),
        requestId: data.requestId,
        payload: {
          provider: data.provider,
          model: data.model,
          error: data.error,
          errorCode: 'UNKNOWN_ERROR',
          httpStatus: 500,
          duration: data.duration,
          retryable: true,
        },
        metadata: {
          source: 'llm-service',
          version: '1.0.0',
        },
      };

      await this.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish request failed event:', error);
    }
  }

  /**
   * 캐시 히트 이벤트 발행
   */
  async publishCacheHit(data: {
    requestId: string;
    cacheKey: string;
    similarity: number;
    timeSaved: number;
  }): Promise<void> {
    try {
      const event: LLMEvent = {
        eventId: uuidv4(),
        eventType: 'CacheHit',
        timestamp: new Date().toISOString(),
        requestId: data.requestId,
        payload: {
          cacheKey: data.cacheKey,
          model: 'unknown',
          similarity: data.similarity,
          cacheAge: 0,
          savedTokens: 0,
          savedCost: 0,
        },
        metadata: {
          source: 'llm-service',
          version: '1.0.0',
        },
      };

      await this.publishEvent(event);
    } catch (error) {
      logger.error('Failed to publish cache hit event:', error);
    }
  }

  /**
   * 간단한 토큰 추정
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

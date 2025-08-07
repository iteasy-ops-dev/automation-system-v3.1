/**
 * Device Management Service Kafka Event Bus
 * 이벤트 발행 및 구독 관리
 */

import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { DeviceEvent } from '@/types';
import { getLogger } from '@/utils';
import { v4 as uuidv4 } from 'uuid';

export class EventBusService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private logger = getLogger();
  private clientId: string;
  private groupId: string;

  constructor(config: {
    brokers: string[];
    clientId: string;
    groupId: string;
  }) {
    this.clientId = config.clientId;
    this.groupId = config.groupId;

    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 30000,
      requestTimeout: 30000
    });

    this.logger.info('Kafka event bus service initialized', { 
      brokers: config.brokers,
      clientId: this.clientId 
    });
  }

  // Producer 초기화
  private async initializeProducer(): Promise<void> {
    if (this.producer) return;

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    await this.producer.connect();
    this.logger.info('Kafka producer connected');
  }

  // Consumer 초기화 (필요시)
  private async initializeConsumer(): Promise<void> {
    if (this.consumer) return;

    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000
    });

    await this.consumer.connect();
    this.logger.info('Kafka consumer connected');
  }

  // Device 이벤트 발행 (device-events.json 스키마 기반)
  async publishDeviceEvent(
    eventType: DeviceEvent['eventType'],
    deviceId: string,
    payload: Record<string, any>,
    metadata?: {
      userId?: string;
      correlationId?: string;
      source?: string;
      tags?: string[];
    }
  ): Promise<boolean> {
    try {
      await this.initializeProducer();

      const event: DeviceEvent = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        deviceId,
        payload,
        metadata: {
          source: 'device-service',
          version: '1.0.0',
          ...metadata
        }
      };

      const message = {
        key: deviceId,
        value: JSON.stringify(event),
        headers: {
          eventType: eventType,
          deviceId: deviceId,
          timestamp: event.timestamp,
          correlationId: metadata?.correlationId || event.eventId
        }
      };

      await this.producer!.send({
        topic: 'device-events',
        messages: [message]
      });

      this.logger.logEventPublished(eventType, deviceId, metadata?.correlationId);
      return true;
    } catch (error) {
      this.logger.error('Publish device event failed', error, { 
        eventType, 
        deviceId, 
        correlationId: metadata?.correlationId 
      });
      return false;
    }
  }

  // 배치 이벤트 발행
  async publishBatchEvents(events: Array<{
    eventType: DeviceEvent['eventType'];
    deviceId: string;
    payload: Record<string, any>;
    metadata?: Record<string, any>;
  }>): Promise<{ success: number; failed: number }> {
    const results = { success: 0, failed: 0 };

    try {
      await this.initializeProducer();

      const messages = events.map(event => {
        const eventObj: DeviceEvent = {
          eventId: uuidv4(),
          eventType: event.eventType,
          timestamp: new Date().toISOString(),
          deviceId: event.deviceId,
          payload: event.payload,
          metadata: {
            source: 'device-service',
            version: '1.0.0',
            ...event.metadata
          }
        };

        return {
          key: event.deviceId,
          value: JSON.stringify(eventObj),
          headers: {
            eventType: event.eventType,
            deviceId: event.deviceId,
            timestamp: eventObj.timestamp,
            correlationId: event.metadata?.correlationId || eventObj.eventId
          }
        };
      });

      await this.producer!.send({
        topic: 'device-events',
        messages
      });

      results.success = events.length;
      this.logger.info('Batch events published', {
        count: events.length,
        topic: 'device-events'
      });

      return results;
    } catch (error) {
      results.failed = events.length;
      this.logger.error('Batch events publish failed', error, {
        count: events.length
      });
      return results;
    }
  }

  // 이벤트 구독 (필요시 사용)
  async subscribeToEvents(
    topics: string[],
    handler: (message: KafkaMessage) => Promise<void>
  ): Promise<void> {
    try {
      await this.initializeConsumer();
      
      await this.consumer!.subscribe({ topics });
      
      await this.consumer!.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await handler(message);
            this.logger.debug('Event processed', {
              topic,
              partition,
              offset: message.offset
            });
          } catch (error) {
            this.logger.error('Event processing failed', error, {
              topic,
              partition,
              offset: message.offset
            });
          }
        }
      });

      this.logger.info('Event subscription started', { topics });
    } catch (error) {
      this.logger.error('Event subscription failed', error, { topics });
      throw error;
    }
  }

  // 헬스체크
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.producer) {
        await this.initializeProducer();
      }

      // 간단한 메타데이터 요청으로 연결 상태 확인
      const admin = this.kafka.admin();
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({ topics: ['device-events'] });
      await admin.disconnect();

      return {
        status: 'healthy',
        details: {
          brokers: metadata.brokers.length,
          topics: metadata.topics.length,
          connected: true
        }
      };
    } catch (error) {
      this.logger.error('Event bus health check failed', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connected: false
        }
      };
    }
  }

  // 서비스 종료
  async close(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }
      
      if (this.consumer) {
        await this.consumer.disconnect();
        this.consumer = null;
      }

      this.logger.info('Kafka event bus service closed');
    } catch (error) {
      this.logger.error('Error closing event bus service', error);
    }
  }
}

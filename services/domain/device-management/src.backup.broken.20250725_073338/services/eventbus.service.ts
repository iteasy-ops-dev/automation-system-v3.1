/**
 * Event Bus Service - 최소 완성형
 * @file src/services/eventbus.service.ts
 * @description Kafka 기반 이벤트 발행 서비스
 */

import { Kafka, Producer, KafkaConfig } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';

export interface KafkaEventConfig {
  brokers: string[];
  clientId: string;
  topic: string;
  requestTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
}

export interface DeviceEvent {
  eventId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 'DeviceStatusChanged' | 'MetricThresholdExceeded';
  timestamp: string;
  deviceId: string;
  payload: Record<string, any>;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
  };
}

export class EventBusService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private logger: Logger;
  private config: KafkaEventConfig;
  private isConnected: boolean = false;

  constructor(config: KafkaEventConfig) {
    this.logger = new Logger();
    this.config = config;

    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId,
      brokers: config.brokers,
      requestTimeout: config.requestTimeout || 30000,
      retry: {
        initialRetryTime: config.retry?.initialRetryTime || 300,
        retries: config.retry?.retries || 5
      }
    };

    this.kafka = new Kafka(kafkaConfig);
    this.logger.info('Event bus service initialized', { 
      clientId: config.clientId, 
      brokers: config.brokers,
      topic: config.topic
    });
  }

  /**
   * Kafka Producer 연결
   */
  async connect(): Promise<void> {
    try {
      if (!this.producer) {
        this.producer = this.kafka.producer({
          maxInFlightRequests: 1,
          idempotent: true,
          transactionTimeout: 30000
        });

        await this.producer.connect();
        this.isConnected = true;
        this.logger.info('Kafka producer connected successfully');
      }
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Failed to connect Kafka producer:', error);
      throw new Error(`Kafka producer connection failed: ${error}`);
    }
  }

  /**
   * 장비 이벤트 발행
   */
  async publishDeviceEvent(
    eventType: DeviceEvent['eventType'], 
    deviceId: string, 
    payload: any,
    metadata?: {
      userId?: string;
      correlationId?: string;
      source?: string;
    }
  ): Promise<boolean> {
    try {
      if (!this.isConnected || !this.producer) {
        await this.connect();
      }

      const event: DeviceEvent = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        deviceId,
        payload,
        metadata: {
          source: 'device-management-service',
          correlationId: metadata?.correlationId || uuidv4(),
          ...metadata
        }
      };

      // device-events.json 스키마 검증
      this.validateDeviceEvent(event);

      const result = await this.producer!.send({
        topic: this.config.topic,
        messages: [
          {
            key: deviceId,
            value: JSON.stringify(event),
            timestamp: Date.now().toString(),
            headers: {
              'event-type': eventType,
              'device-id': deviceId,
              'event-id': event.eventId
            }
          }
        ]
      });

      this.logger.info('Device event published', {
        eventId: event.eventId,
        eventType,
        deviceId,
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to publish device event:', { 
        eventType, 
        deviceId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 장비 생성 이벤트 발행
   */
  async publishDeviceCreated(
    deviceId: string, 
    device: { name: string; type: string; groupId?: string },
    metadata?: { userId?: string; correlationId?: string }
  ): Promise<boolean> {
    return this.publishDeviceEvent('DeviceCreated', deviceId, { device }, metadata);
  }

  /**
   * 장비 업데이트 이벤트 발행
   */
  async publishDeviceUpdated(
    deviceId: string, 
    changes: Record<string, any>,
    metadata?: { userId?: string; correlationId?: string }
  ): Promise<boolean> {
    return this.publishDeviceEvent('DeviceUpdated', deviceId, { changes }, metadata);
  }

  /**
   * 장비 상태 변경 이벤트 발행
   */
  async publishDeviceStatusChanged(
    deviceId: string, 
    statusChange: { previousStatus: string; currentStatus: string; reason?: string },
    metadata?: { userId?: string; correlationId?: string }
  ): Promise<boolean> {
    return this.publishDeviceEvent('DeviceStatusChanged', deviceId, statusChange, metadata);
  }

  /**
   * 메트릭 임계값 초과 이벤트 발행
   */
  async publishMetricThresholdExceeded(
    deviceId: string, 
    thresholdData: { metric: string; threshold: number; currentValue: number },
    metadata?: { userId?: string; correlationId?: string }
  ): Promise<boolean> {
    return this.publishDeviceEvent('MetricThresholdExceeded', deviceId, thresholdData, metadata);
  }

  /**
   * DeviceEvent 스키마 검증 (device-events.json 준수)
   */
  private validateDeviceEvent(event: DeviceEvent): void {
    // 필수 필드 검증
    if (!event.eventId || !event.eventType || !event.timestamp || !event.deviceId) {
      throw new Error('Missing required fields in device event');
    }

    // eventType 검증
    const validEventTypes = ['DeviceCreated', 'DeviceUpdated', 'DeviceDeleted', 'DeviceStatusChanged', 'MetricThresholdExceeded'];
    if (!validEventTypes.includes(event.eventType)) {
      throw new Error(`Invalid event type: ${event.eventType}`);
    }

    // timestamp 형식 검증
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!timestampRegex.test(event.timestamp)) {
      throw new Error('Invalid timestamp format');
    }

    // deviceId UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(event.deviceId)) {
      this.logger.warn('DeviceId is not in UUID format', { deviceId: event.deviceId });
    }

    // eventType별 payload 검증
    switch (event.eventType) {
      case 'DeviceCreated':
        if (!event.payload.device || !event.payload.device.name || !event.payload.device.type) {
          throw new Error('DeviceCreated event must include device.name and device.type');
        }
        break;
      case 'DeviceStatusChanged':
        if (!event.payload.previousStatus || !event.payload.currentStatus) {
          throw new Error('DeviceStatusChanged event must include previousStatus and currentStatus');
        }
        break;
      case 'MetricThresholdExceeded':
        if (!event.payload.metric || event.payload.threshold === undefined || event.payload.currentValue === undefined) {
          throw new Error('MetricThresholdExceeded event must include metric, threshold, and currentValue');
        }
        break;
    }
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      if (!this.isConnected || !this.producer) {
        await this.connect();
      }

      // Kafka admin client를 별도로 생성하여 토픽 메타데이터 확인
      const admin = this.kafka.admin();
      await admin.connect();
      
      try {
        const metadata = await admin.fetchTopicMetadata({ topics: [this.config.topic] });
        
        return {
          status: 'healthy',
          details: {
            connected: this.isConnected,
            topic: this.config.topic,
            partitions: metadata.topics[0]?.partitions?.length || 0,
            kafka: {
              clientId: this.config.clientId,
              brokers: this.config.brokers
            }
          }
        };
      } finally {
        await admin.disconnect();
      }
    } catch (error) {
      this.logger.error('Event bus health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * 연결 상태 확인
   */
  isHealthy(): boolean {
    return this.isConnected && this.producer !== null;
  }

  /**
   * 서비스 종료
   */
  async close(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }
      this.isConnected = false;
      this.logger.info('Event bus service closed');
    } catch (error) {
      this.logger.error('Error closing event bus service:', error);
    }
  }
}

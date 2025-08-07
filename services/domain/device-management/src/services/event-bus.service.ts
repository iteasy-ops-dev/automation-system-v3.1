/**
 * Event Bus Service - Device Management Service
 * Kafka 직접 연동 (v3.1 아키텍처에서 필수)
 * device-events 토픽 이벤트 발행
 */

import { Kafka, Producer, Consumer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { DeviceEvent, DeviceEventType } from '../types';

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export class EventBusService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private logger: Logger;
  private config: KafkaConfig;
  private isConnected: boolean = false;

  constructor(config: KafkaConfig) {
    this.config = config;
    this.logger = new Logger('EventBusService');
    
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    this.consumer = this.kafka.consumer({ 
      groupId: config.groupId 
    });
  }

  /**
   * Kafka 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      // 연결 시도 전에 타임아웃 설정
      const connectTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Kafka connection timeout')), 10000);
      });

      await Promise.race([
        this.producer.connect(),
        connectTimeout
      ]);
      
      this.isConnected = true;
      
      this.logger.logSuccess('Kafka producer connected successfully', {
        brokers: this.config.brokers,
        clientId: this.config.clientId
      });
    } catch (error) {
      this.logger.logError('Failed to connect to Kafka', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 연결 상태 확인
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.producer.disconnect();
        this.isConnected = false;
        this.logger.info('Kafka producer disconnected');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error);
    }
  }

  // ============ Device Events 발행 ============

  /**
   * Device 이벤트 발행 (device-events 토픽)
   */
  async publishDeviceEvent(
    eventType: DeviceEventType,
    deviceId: string,
    payload: Record<string, any>,
    metadata?: {
      userId?: string;
      correlationId?: string;
      source?: string;
    }
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Event bus is not connected');
    }

    try {
      const event: DeviceEvent = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        deviceId,
        payload,
        metadata: {
          source: 'device-management-service',
          ...metadata
        }
      };

      await this.producer.send({
        topic: 'device-events',
        messages: [{
          key: deviceId,
          value: JSON.stringify(event),
          headers: {
            eventType: eventType,
            deviceId: deviceId,
            timestamp: event.timestamp
          }
        }]
      });

      this.logger.info('Device event published', {
        eventType,
        deviceId,
        eventId: event.eventId
      });
    } catch (error) {
      this.logger.error('Failed to publish device event', error, {
        eventType,
        deviceId
      });
      throw error;
    }
  }

  /**
   * DeviceCreated 이벤트 발행
   */
  async publishDeviceCreated(deviceId: string, device: any): Promise<void> {
    await this.publishDeviceEvent('DeviceCreated', deviceId, { device });
  }

  /**
   * DeviceUpdated 이벤트 발행
   */
  async publishDeviceUpdated(deviceId: string, updates: any, previousData?: any): Promise<void> {
    await this.publishDeviceEvent('DeviceUpdated', deviceId, { updates, previousData });
  }

  /**
   * DeviceDeleted 이벤트 발행
   */
  async publishDeviceDeleted(deviceId: string, device: any): Promise<void> {
    await this.publishDeviceEvent('DeviceDeleted', deviceId, { device });
  }

  /**
   * DeviceStatusChanged 이벤트 발행
   */
  async publishDeviceStatusChanged(
    deviceId: string, 
    previousStatus: string, 
    currentStatus: string,
    reason?: string
  ): Promise<void> {
    await this.publishDeviceEvent('DeviceStatusChanged', deviceId, {
      previousStatus,
      currentStatus,
      reason
    });
  }

  /**
   * MetricThresholdExceeded 이벤트 발행
   */
  async publishMetricThresholdExceeded(
    deviceId: string,
    metric: string,
    currentValue: number,
    threshold: number
  ): Promise<void> {
    await this.publishDeviceEvent('MetricThresholdExceeded', deviceId, {
      metric,
      currentValue,
      threshold
    });
  }

  /**
   * DeviceHealthCheck 이벤트 발행
   */
  async publishDeviceHealthCheck(
    deviceId: string,
    checkResult: {
      success: boolean;
      responseTime: number;
      protocol: string;
      timestamp: string;
    }
  ): Promise<void> {
    await this.publishDeviceEvent('DeviceHealthCheck', deviceId, checkResult);
  }

  /**
   * 연결 상태 확인
   */
  isConnectedToBroker(): boolean {
    return this.isConnected;
  }

  /**
   * Kafka 클러스터 헬스 체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({ topics: ['device-events'] });
      await admin.disconnect();
      
      return metadata.topics.length > 0;
    } catch (error) {
      this.logger.error('Kafka health check failed', error);
      return false;
    }
  }
}

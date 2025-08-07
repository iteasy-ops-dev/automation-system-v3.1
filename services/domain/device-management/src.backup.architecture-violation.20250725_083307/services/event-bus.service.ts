/**
 * Event Bus Service - Device Management Service
 * Kafka 기반 이벤트 발행 서비스
 * 계약(shared/contracts/v1.0/events/device-events.json) 100% 준수
 */

import { Kafka, Producer } from 'kafkajs';
import { Logger } from '../utils/logger';
import { DeviceEvent } from '../types';

export class EventBusService {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected: boolean = false;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('event-bus');
    
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'device-management-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });
  }

  /**
   * Kafka 연결
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.info('Kafka producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', { error });
      throw error;
    }
  }

  /**
   * Kafka 연결 해제
   */
  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      this.logger.info('Kafka producer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', { error });
    }
  }

  /**
   * 이벤트 발행 (일반용)
   */
  async publish(topic: string, event: any): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('EventBus is not connected');
      }

      await this.producer.send({
        topic,
        messages: [{
          key: event.eventId || String(Date.now()),
          value: JSON.stringify(event),
          timestamp: event.timestamp ? new Date(event.timestamp).getTime().toString() : undefined
        }]
      });

      this.logger.debug('Event published successfully', { 
        topic,
        eventType: event.eventType,
        eventId: event.eventId 
      });
    } catch (error) {
      this.logger.error('Failed to publish event', { 
        error,
        topic,
        eventType: event.eventType 
      });
      throw error;
    }
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

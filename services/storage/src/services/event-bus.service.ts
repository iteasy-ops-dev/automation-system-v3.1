/**
 * Event Bus Service - crypto 문제 해결
 * Node.js crypto 모듈 import 추가
 */

import { Kafka, Producer, Consumer, Admin } from 'kafkajs';
import { Logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export interface EventMessage {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: any;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
  };
}

export class EventBusService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private admin: Admin | null = null;
  private logger: Logger;

  constructor(config: KafkaConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8
      }
    });

    this.logger = new Logger('EventBusService');
  }

  async connect(): Promise<void> {
    try {
      await this.initializeProducer();
      await this.initializeAdmin();
      this.logger.info('Event Bus connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Event Bus', { error });
      throw error;
    }
  }

  private async initializeProducer(): Promise<void> {
    try {
      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000
      });

      await this.producer.connect();
      this.logger.info('Kafka producer connected');
    } catch (error) {
      this.logger.error('Failed to initialize producer', { error });
      throw error;
    }
  }

  private async initializeAdmin(): Promise<void> {
    try {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      this.logger.info('Kafka admin connected');
    } catch (error) {
      this.logger.error('Failed to initialize admin', { error });
      throw error;
    }
  }

  async publishEvent(topic: string, event: any): Promise<void> {
    try {
      if (!this.producer) {
        throw new Error('Producer not initialized');
      }

      let message: EventMessage;
      if (event.eventId && event.eventType) {
        message = event as EventMessage;
      } else {
        message = {
          eventId: randomUUID(),
          eventType: 'GenericEvent',
          timestamp: new Date().toISOString(),
          payload: event,
          metadata: {
            source: 'storage-service'
          }
        };
      }

      await this.producer.send({
        topic,
        messages: [{
          key: message.eventId,
          value: JSON.stringify(message),
          timestamp: Date.now().toString()
        }]
      });

      this.logger.debug('Event published', { 
        topic, 
        eventId: message.eventId, 
        eventType: message.eventType 
      });
    } catch (error) {
      this.logger.error('Failed to publish event', { topic, error });
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.admin) {
        return false;
      }
      await this.admin.fetchTopicMetadata();
      return true;
    } catch (error) {
      this.logger.warn('Event Bus health check failed', { error });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
        this.logger.info('Producer disconnected');
      }

      const consumerEntries = Array.from(this.consumers.entries());
      for (const [key, consumer] of consumerEntries) {
        await consumer.disconnect();
        this.logger.info('Consumer disconnected', { key });
      }
      this.consumers.clear();

      if (this.admin) {
        await this.admin.disconnect();
        this.admin = null;
        this.logger.info('Admin disconnected');
      }

      this.logger.info('Event Bus disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting Event Bus', { error });
      throw error;
    }
  }
}

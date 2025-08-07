/**
 * Event Repository (MongoDB)
 * 이벤트 로그 및 문서형 데이터 관리
 * 계약 기반 이벤트 스키마 준수
 */

import { Collection, MongoClient } from 'mongodb';
import { logger } from '../utils/logger';

export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
  };
}

export interface DeviceEvent extends BaseEvent {
  deviceId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 'DeviceStatusChanged' | 'MetricThresholdExceeded';
  payload: any;
}

export interface WorkflowEvent extends BaseEvent {
  workflowId: string;
  executionId: string;
  eventType: 'WorkflowStarted' | 'WorkflowStepCompleted' | 'WorkflowCompleted' | 'WorkflowFailed';
  payload?: {
    stepId?: string;
    stepName?: string;
    result?: any;
    error?: string;
    duration?: number;
  };
}

export interface MCPEvent extends BaseEvent {
  serverId?: string;
  executionId?: string;
  eventType: 'MCPServerRegistered' | 'ToolsDiscovered' | 'ExecutionStarted' | 'ExecutionCompleted' | 'ExecutionFailed';
  payload?: {
    tool?: string;
    params?: any;
    result?: any;
    error?: string;
    duration?: number;
    tools?: Array<{
      name: string;
      description: string;
      version: string;
    }>;
  };
}

export interface LLMEvent extends BaseEvent {
  requestId: string;
  eventType: 'LLMRequestStarted' | 'LLMRequestCompleted' | 'LLMRequestFailed' | 'TokenLimitExceeded' | 'ModelSwitched';
  payload?: {
    provider?: string;
    model?: string;
    tokens?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    cost?: number;
    error?: string;
    duration?: number;
  };
}

export class EventRepository {
  private db: MongoClient;
  private collection: Collection;

  constructor(db: MongoClient) {
    this.db = db;
    this.collection = db.db('automation').collection('event_logs');
  }

  /**
   * Device 이벤트 저장
   */
  async saveDeviceEvent(event: DeviceEvent): Promise<void> {
    try {
      this.validateDeviceEvent(event);
      
      const document = {
        ...event,
        timestamp: new Date(event.timestamp),
        createdAt: new Date()
      };

      await this.collection.insertOne(document);
      logger.info(`Device event saved: ${event.eventType}`, { eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to save device event:', error);
      throw error;
    }
  }

  /**
   * Workflow 이벤트 저장
   */
  async saveWorkflowEvent(event: WorkflowEvent): Promise<void> {
    try {
      this.validateWorkflowEvent(event);
      
      const document = {
        ...event,
        timestamp: new Date(event.timestamp),
        createdAt: new Date()
      };

      await this.collection.insertOne(document);
      logger.info(`Workflow event saved: ${event.eventType}`, { eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to save workflow event:', error);
      throw error;
    }
  }

  /**
   * MCP 이벤트 저장
   */
  async saveMCPEvent(event: MCPEvent): Promise<void> {
    try {
      this.validateMCPEvent(event);
      
      const document = {
        ...event,
        timestamp: new Date(event.timestamp),
        createdAt: new Date()
      };

      await this.collection.insertOne(document);
      logger.info(`MCP event saved: ${event.eventType}`, { eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to save MCP event:', error);
      throw error;
    }
  }

  /**
   * LLM 이벤트 저장
   */
  async saveLLMEvent(event: LLMEvent): Promise<void> {
    try {
      this.validateLLMEvent(event);
      
      const document = {
        ...event,
        timestamp: new Date(event.timestamp),
        createdAt: new Date()
      };

      await this.collection.insertOne(document);
      logger.info(`LLM event saved: ${event.eventType}`, { eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to save LLM event:', error);
      throw error;
    }
  }

  /**
   * 이벤트 조회 (페이징)
   */
  async findEvents(filters: {
    eventType?: string;
    deviceId?: string;
    workflowId?: string;
    executionId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: any[]; total: number }> {
    try {
      const query: any = {};

      if (filters.eventType) {
        query.eventType = filters.eventType;
      }

      if (filters.deviceId) {
        query.deviceId = filters.deviceId;
      }

      if (filters.workflowId) {
        query.workflowId = filters.workflowId;
      }

      if (filters.executionId) {
        query.executionId = filters.executionId;
      }

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.timestamp.$lte = filters.endDate;
        }
      }

      const total = await this.collection.countDocuments(query);
      
      const events = await this.collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 20)
        .toArray();

      return { events, total };
    } catch (error) {
      logger.error('Failed to find events:', error);
      throw error;
    }
  }

  /**
   * Device 이벤트 검증
   */
  private validateDeviceEvent(event: DeviceEvent): void {
    const validTypes = ['DeviceCreated', 'DeviceUpdated', 'DeviceDeleted', 'DeviceStatusChanged', 'MetricThresholdExceeded'];
    if (!validTypes.includes(event.eventType)) {
      throw new Error(`Invalid device event type: ${event.eventType}`);
    }

    if (!event.deviceId) {
      throw new Error('Device ID is required for device events');
    }
  }

  /**
   * Workflow 이벤트 검증
   */
  private validateWorkflowEvent(event: WorkflowEvent): void {
    const validTypes = ['WorkflowStarted', 'WorkflowStepCompleted', 'WorkflowCompleted', 'WorkflowFailed'];
    if (!validTypes.includes(event.eventType)) {
      throw new Error(`Invalid workflow event type: ${event.eventType}`);
    }

    if (!event.workflowId) {
      throw new Error('Workflow ID is required for workflow events');
    }

    if (!event.executionId) {
      throw new Error('Execution ID is required for workflow events');
    }
  }

  /**
   * MCP 이벤트 검증
   */
  private validateMCPEvent(event: MCPEvent): void {
    const validTypes = ['MCPServerRegistered', 'ToolsDiscovered', 'ExecutionStarted', 'ExecutionCompleted', 'ExecutionFailed'];
    if (!validTypes.includes(event.eventType)) {
      throw new Error(`Invalid MCP event type: ${event.eventType}`);
    }
  }

  /**
   * LLM 이벤트 검증
   */
  private validateLLMEvent(event: LLMEvent): void {
    const validTypes = ['LLMRequestStarted', 'LLMRequestCompleted', 'LLMRequestFailed', 'TokenLimitExceeded', 'ModelSwitched'];
    if (!validTypes.includes(event.eventType)) {
      throw new Error(`Invalid LLM event type: ${event.eventType}`);
    }

    if (!event.requestId) {
      throw new Error('Request ID is required for LLM events');
    }
  }

  /**
   * 인덱스 확인 및 생성
   */
  async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ eventType: 1 });
      await this.collection.createIndex({ timestamp: -1 });
      await this.collection.createIndex({ deviceId: 1 });
      await this.collection.createIndex({ workflowId: 1 });
      await this.collection.createIndex({ executionId: 1 });
      await this.collection.createIndex({ 'metadata.correlationId': 1 });
      
      logger.info('Event repository indexes ensured');
    } catch (error) {
      logger.error('Failed to ensure indexes:', error);
      throw error;
    }
  }
}

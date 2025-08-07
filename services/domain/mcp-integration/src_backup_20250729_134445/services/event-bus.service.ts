/**
 * Event Bus Service - MCP Integration Service
 * Kafka 기반 이벤트 발행 서비스
 * 계약(shared/contracts/v1.0/events/mcp-events.json) 100% 준수
 */

import { Kafka, Producer } from 'kafkajs';
import { Logger } from '../utils/logger';
import { MCPEvent } from '../types';

export class EventBusService {
  private kafka: Kafka;
  private producer: Producer;
  private logger: Logger;
  private isConnected: boolean = false;

  constructor() {
    this.logger = new Logger('event-bus');
    
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'mcp-integration-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
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
  }

  /**
   * Kafka 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.info('Kafka producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka:', error);
      throw error;
    }
  }

  /**
   * Kafka 연결 종료
   */
  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      this.logger.info('Kafka producer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka:', error);
    }
  }

  /**
   * MCP 이벤트 발행 (계약 준수)
   */
  async publishMCPEvent(eventType: MCPEvent['eventType'], data: Partial<MCPEvent>): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Kafka not connected, attempting to connect...');
      await this.connect();
    }

    const event: MCPEvent = {
      eventId: data.eventId || this.generateEventId(),
      eventType,
      timestamp: new Date().toISOString(),
      serverId: data.serverId,
      executionId: data.executionId,
      payload: data.payload || {}
    };

    try {
      await this.producer.send({
        topic: 'mcp-events',
        messages: [{
          key: event.serverId || event.executionId || event.eventId,
          value: JSON.stringify(event),
          timestamp: Date.now().toString(),
          headers: {
            eventType: eventType,
            eventId: event.eventId
          }
        }]
      });

      this.logger.info(`📤 MCP Event published: ${eventType}`, {
        eventId: event.eventId,
        serverId: event.serverId,
        executionId: event.executionId
      });
    } catch (error) {
      this.logger.error(`Failed to publish MCP event: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * MCP 서버 등록 이벤트
   */
  async publishServerRegistered(serverId: string, serverData: any): Promise<void> {
    await this.publishMCPEvent('MCPServerRegistered', {
      serverId,
      payload: {
        name: serverData.name,
        serverType: serverData.serverType,
        endpointUrl: serverData.endpointUrl,
        version: serverData.version
      }
    });
  }

  /**
   * MCP 서버 업데이트 이벤트
   */
  async publishServerUpdated(serverId: string, changes: any): Promise<void> {
    await this.publishMCPEvent('MCPServerUpdated', {
      serverId,
      payload: { changes }
    });
  }

  /**
   * MCP 서버 제거 이벤트
   */
  async publishServerDeregistered(serverId: string): Promise<void> {
    await this.publishMCPEvent('MCPServerDeregistered', {
      serverId,
      payload: {}
    });
  }

  /**
   * MCP 서버 연결 설정 이벤트
   */
  async publishServerConnectionEstablished(serverId: string): Promise<void> {
    await this.publishMCPEvent('MCPServerConnectionEstablished', {
      serverId,
      payload: {
        connectedAt: new Date().toISOString()
      }
    });
  }

  /**
   * MCP 서버 연결 해제 이벤트
   */
  async publishServerConnectionLost(serverId: string, reason?: string): Promise<void> {
    await this.publishMCPEvent('MCPServerConnectionLost', {
      serverId,
      payload: {
        reason: reason || 'Unknown',
        disconnectedAt: new Date().toISOString()
      }
    });
  }

  /**
   * 도구 발견 이벤트
   */
  async publishToolsDiscovered(serverId: string, tools: any[]): Promise<void> {
    await this.publishMCPEvent('ToolsDiscovered', {
      serverId,
      payload: {
        toolCount: tools.length,
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          version: tool.version
        }))
      }
    });
  }

  /**
   * 도구 업데이트 이벤트
   */
  async publishToolUpdated(serverId: string, toolName: string, changes: any): Promise<void> {
    await this.publishMCPEvent('ToolUpdated', {
      serverId,
      payload: {
        toolName,
        changes
      }
    });
  }

  /**
   * 실행 시작 이벤트
   */
  async publishExecutionStarted(executionId: string, serverId: string, toolName: string, params: any): Promise<void> {
    await this.publishMCPEvent('ExecutionStarted', {
      serverId,
      executionId,
      payload: {
        tool: toolName,
        params,
        startedAt: new Date().toISOString()
      }
    });
  }

  /**
   * 실행 완료 이벤트 (계약의 ExecutionCompleted 스키마 준수)
   */
  async publishExecutionCompleted(executionId: string, serverId: string, result: any, duration: number): Promise<void> {
    await this.publishMCPEvent('ExecutionCompleted', {
      serverId,
      executionId,
      payload: {
        result,
        duration,
        completedAt: new Date().toISOString()
      }
    });
  }

  /**
   * 실행 실패 이벤트
   */
  async publishExecutionFailed(executionId: string, serverId: string, error: string): Promise<void> {
    await this.publishMCPEvent('ExecutionFailed', {
      serverId,
      executionId,
      payload: {
        error,
        failedAt: new Date().toISOString()
      }
    });
  }

  /**
   * 실행 취소 이벤트
   */
  async publishExecutionCancelled(executionId: string, serverId: string, reason?: string): Promise<void> {
    await this.publishMCPEvent('ExecutionCancelled', {
      serverId,
      executionId,
      payload: {
        reason: reason || 'User cancelled',
        cancelledAt: new Date().toISOString()
      }
    });
  }

  /**
   * 연결 상태 확인
   */
  isConnectedToBroker(): boolean {
    return this.isConnected;
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
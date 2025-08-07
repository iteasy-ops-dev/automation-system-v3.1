/**
 * 기본 Transport 인터페이스
 * Model Context Protocol의 다양한 전송 방식을 지원
 */

import { EventEmitter } from 'events';
import { JsonRpcRequest, JsonRpcResponse } from '../../types';

export enum TransportType {
  STDIO = 'stdio',
  SSH = 'ssh',
  DOCKER = 'docker',
  HTTP = 'http'
}

export enum TransportStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface TransportConfig {
  type: TransportType;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface TransportEvents {
  'connect': () => void;
  'disconnect': () => void;
  'error': (error: Error) => void;
  'message': (message: any) => void;
  'status': (status: TransportStatus) => void;
}

export abstract class BaseTransport extends EventEmitter {
  protected status: TransportStatus = TransportStatus.DISCONNECTED;
  protected config: TransportConfig; // private → protected로 변경
  protected requestId: number = 1;

  constructor(config: TransportConfig) {
    super();
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * 연결 설정
   */
  abstract connect(): Promise<void>;

  /**
   * 연결 종료
   */
  abstract disconnect(): Promise<void>;

  /**
   * JSON-RPC 요청 전송
   */
  abstract sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;

  /**
   * 현재 상태 반환
   */
  getStatus(): TransportStatus {
    return this.status;
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.status === TransportStatus.CONNECTED;
  }

  /**
   * 상태 변경
   */
  protected setStatus(status: TransportStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('status', status);
    }
  }

  /**
   * 고유한 요청 ID 생성
   */
  protected generateRequestId(): number {
    return this.requestId++;
  }

  /**
   * 재시도 로직
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.config.retryAttempts || 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        await this.delay(this.config.retryDelay || 1000);
      }
    }
    
    throw lastError!;
  }

  /**
   * 지연 함수
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

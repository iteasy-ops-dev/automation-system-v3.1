/**
 * STDIO Transport 구현
 * Model Context Protocol - Standard I/O 통신
 */

import { spawn, ChildProcess } from 'child_process';
import { BaseTransport, TransportType, TransportStatus } from './base.transport';
import { JsonRpcRequest, JsonRpcResponse } from '../../types';
import { Logger } from '../../utils/logger';

export interface StdioTransportConfig {
  type: TransportType.STDIO;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class StdioTransport extends BaseTransport {
  private logger: Logger;
  private process?: ChildProcess;
  private pendingRequests: Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private buffer: string = '';

  constructor(protected config: StdioTransportConfig) { // private → protected
    super(config);
    this.logger = new Logger(`stdio-transport-${config.command}`);
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    return this.withRetry(async () => {
      this.setStatus(TransportStatus.CONNECTING);
      
      try {
        // 자식 프로세스 생성
        this.process = spawn(this.config.command, this.config.args || [], {
          cwd: this.config.cwd,
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // 이벤트 핸들러 설정
        this.setupProcessHandlers();

        // 연결 대기 (프로세스가 정상적으로 시작되는지 확인)
        await this.waitForConnection();

        this.setStatus(TransportStatus.CONNECTED);
        this.emit('connect');
        
        this.logger.info('✅ STDIO transport connected', {
          command: this.config.command,
          args: this.config.args,
          pid: this.process.pid
        });

      } catch (error) {
        this.setStatus(TransportStatus.ERROR);
        this.logger.error('❌ Failed to connect STDIO transport:', error);
        throw error;
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.process) {
      return;
    }

    this.setStatus(TransportStatus.DISCONNECTED);

    // 대기 중인 요청들 취소
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    // 프로세스 종료
    try {
      this.process.kill('SIGTERM');
      
      // 강제 종료 대기
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

    } catch (error) {
      this.logger.warn('⚠️ Error killing process:', error);
    }

    this.process = undefined;
    this.emit('disconnect');
    
    this.logger.info('✅ STDIO transport disconnected');
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected() || !this.process) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer: timeout
      });

      // 요청 전송
      const message = JSON.stringify(request) + '\n';
      
      this.process!.stdin!.write(message, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });

      this.logger.debug('📤 Sent JSON-RPC request', {
        id: request.id,
        method: request.method
      });
    });
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    // stdout 처리 (JSON-RPC 응답)
    this.process.stdout!.on('data', (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    // stderr 처리 (로그)
    this.process.stderr!.on('data', (data: Buffer) => {
      this.logger.warn('📢 Process stderr:', data.toString().trim());
    });

    // 프로세스 종료 처리
    this.process.on('exit', (code, signal) => {
      this.logger.info('🔚 Process exited', { code, signal });
      this.setStatus(TransportStatus.DISCONNECTED);
      this.emit('disconnect');
    });

    // 에러 처리
    this.process.on('error', (error) => {
      this.logger.error('❌ Process error:', error);
      this.setStatus(TransportStatus.ERROR);
      this.emit('error', error);
    });
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    
    // 줄바꿈으로 구분된 JSON 메시지 파싱
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // 마지막 불완전한 줄은 버퍼에 보관

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as JsonRpcResponse;
          this.handleResponse(response);
        } catch (error) {
          this.logger.warn('⚠️ Failed to parse JSON response:', {
            line,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    this.logger.debug('📥 Received JSON-RPC response', {
      id: response.id,
      hasResult: !!response.result,
      hasError: !!response.error
    });

    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(response.id);
      pending.resolve(response);
    } else {
      this.logger.warn('⚠️ Received response for unknown request ID:', response.id);
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        return reject(new Error('Process not created'));
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      // 프로세스가 시작되면 연결된 것으로 간주
      const checkConnection = () => {
        if (this.process && this.process.pid) {
          clearTimeout(timeout);
          resolve();
        }
      };

      // 즉시 확인
      setTimeout(checkConnection, 100);
    });
  }
}

/**
 * MCP Stdio Transport 구현
 * 로컬 프로세스와 stdio 기반 통신
 */

import { spawn, ChildProcess } from 'child_process';
import { BaseMCPTransport } from './base-transport';
import { JsonRpcRequest, JsonRpcResponse, MCPConnectionError } from '../types';

export class StdioTransport extends BaseMCPTransport {
  private process: ChildProcess | null = null;
  private messageQueue: Map<string | number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  async connect(): Promise<void> {
    try {
      if (!this.server.command) {
        throw new MCPConnectionError('Stdio transport requires command');
      }

      const args = this.server.args || [];
      this.process = spawn(this.server.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      this.setupProcessHandlers();
      
      // 프로세스 시작 대기
      await this.waitForProcess();
      
      // MCP 핸드셰이크 수행
      await this.performHandshake();
      
      this.connected = true;      this.logger.info(`Stdio transport connected: ${this.server.name}`, {
        serverId: this.server.id,
        command: this.server.command,
        args
      });

    } catch (error) {
      this.logError('connect', error);
      await this.cleanup();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.process) {
        // 정중한 종료 요청
        if (this.connected) {
          try {
            await this.send({
              jsonrpc: '2.0',
              method: 'notifications/terminated',
              params: {}
            });
          } catch (error) {
            // 종료 알림 실패는 무시
          }
        }

        this.process.kill('SIGTERM');
        
        // 5초 후 강제 종료
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      }

      await this.cleanup();
      this.connected = false;
      
    } catch (error) {
      this.logError('disconnect', error);
      throw error;
    }
  }  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.process || !this.connected) {
      throw new MCPConnectionError('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = request.id || this.generateRequestId();
      const timeout = setTimeout(() => {
        this.messageQueue.delete(requestId);
        reject(new MCPConnectionError('Request timeout'));
      }, 30000); // 30초 타임아웃

      this.messageQueue.set(requestId, { resolve, reject, timeout });

      const message = JSON.stringify({ ...request, id: requestId }) + '\n';
      
      if (!this.process?.stdin?.write(message)) {
        this.messageQueue.delete(requestId);
        clearTimeout(timeout);
        reject(new MCPConnectionError('Failed to write to process stdin'));
      }
    });
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    // stdout에서 JSON-RPC 응답 읽기
    let buffer = '';
    this.process.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      
      // 줄바꿈으로 구분된 JSON 메시지 처리
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 마지막 불완전한 줄 보관

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim());
        }
      }
    });

    // stderr 로깅
    this.process.stderr?.on('data', (data: Buffer) => {
      this.logger.warn(`MCP stderr: ${data.toString()}`, {
        serverId: this.server.id
      });
    });

    // 프로세스 종료 처리
    this.process.on('exit', (code, signal) => {
      this.logger.info(`MCP process exited`, {
        serverId: this.server.id,
        code,
        signal
      });
      this.connected = false;
      this.rejectPendingRequests(new MCPConnectionError('Process exited'));
    });

    // 프로세스 에러 처리
    this.process.on('error', (error) => {
      this.logError('process', error);
      this.connected = false;
      this.rejectPendingRequests(error);
    });
  }  private handleMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      const response = this.validateJsonRpcResponse(parsed);

      if (response.id && this.messageQueue.has(response.id)) {
        const pending = this.messageQueue.get(response.id)!;
        this.messageQueue.delete(response.id);
        clearTimeout(pending.timeout);
        pending.resolve(response);
      } else {
        // 알림 메시지 처리
        this.handleNotification(response);
      }

    } catch (error) {
      this.logger.error('Failed to parse MCP message', {
        serverId: this.server.id,
        message,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handleNotification(message: any): void {
    // MCP 알림 메시지 처리 (로깅 등)
    if (message.method === 'notifications/message') {
      this.logger.info('MCP notification', {
        serverId: this.server.id,
        level: message.params?.level,
        data: message.params?.data
      });
    }
  }

  private waitForProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new MCPConnectionError('Process not started'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new MCPConnectionError('Process start timeout'));
      }, 10000);

      // stdout이 readable해지면 준비된 것으로 간주
      this.process.stdout?.once('readable', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.process.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }  private rejectPendingRequests(error: Error): void {
    for (const [id, pending] of this.messageQueue) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.messageQueue.clear();
  }

  private async cleanup(): Promise<void> {
    this.rejectPendingRequests(new MCPConnectionError('Connection closed'));
    
    if (this.process) {
      this.process.removeAllListeners();
      this.process = null;
    }
  }
}
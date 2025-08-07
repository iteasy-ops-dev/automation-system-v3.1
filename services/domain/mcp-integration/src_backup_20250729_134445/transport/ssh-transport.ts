/**
 * MCP SSH Transport 구현
 * 원격 SSH 연결을 통한 MCP 통신
 */

import { Client, ConnectConfig } from 'ssh2';
import { BaseMCPTransport } from './base-transport';
import { JsonRpcRequest, JsonRpcResponse, MCPConnectionError } from '../types';
import * as fs from 'fs';

export class SSHTransport extends BaseMCPTransport {
  private sshClient: Client | null = null;
  private stream: any = null; // SSH stream
  private messageQueue: Map<string | number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  async connect(): Promise<void> {
    try {
      if (!this.server.sshConfig) {
        throw new MCPConnectionError('SSH transport requires sshConfig');
      }

      const config = this.buildSSHConfig();
      this.sshClient = new Client();

      await this.establishSSHConnection(config);
      await this.startMCPProcess();
      await this.performHandshake();

      this.connected = true;
      this.logger.info(`SSH transport connected: ${this.server.name}`, {
        serverId: this.server.id,
        host: this.server.sshConfig.host,
        port: this.server.sshConfig.port
      });

    } catch (error) {
      this.logError('connect', error);
      await this.cleanup();
      throw error;
    }
  }  async disconnect(): Promise<void> {
    try {
      // 정중한 종료 알림
      if (this.connected) {
        try {
          await this.send({
            jsonrpc: '2.0',
            method: 'notifications/terminated',
            params: {}
          });
        } catch (error) {
          // 종료 알림 실패 무시
        }
      }

      await this.cleanup();
      this.connected = false;

    } catch (error) {
      this.logError('disconnect', error);
      throw error;
    }
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.stream || !this.connected) {
      throw new MCPConnectionError('SSH transport not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = request.id || this.generateRequestId();
      const timeout = setTimeout(() => {
        this.messageQueue.delete(requestId);
        reject(new MCPConnectionError('Request timeout'));
      }, 45000); // SSH는 더 긴 타임아웃

      this.messageQueue.set(requestId, { resolve, reject, timeout });

      const message = JSON.stringify({ ...request, id: requestId }) + '\n';
      
      this.stream.write(message, (error: any) => {
        if (error) {
          this.messageQueue.delete(requestId);
          clearTimeout(timeout);
          reject(new MCPConnectionError(`Failed to write to SSH stream: ${error.message}`));
        }
      });
    });
  }  private buildSSHConfig(): ConnectConfig {
    const sshConfig = this.server.sshConfig!;
    const config: ConnectConfig = {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3
    };

    // 인증 방식 설정
    if (sshConfig.password) {
      config.password = sshConfig.password;
    }

    if (sshConfig.privateKey) {
      try {
        // 파일 경로인지 직접 키인지 판단
        if (sshConfig.privateKey.includes('-----BEGIN')) {
          config.privateKey = sshConfig.privateKey;
        } else if (fs.existsSync(sshConfig.privateKey)) {
          config.privateKey = fs.readFileSync(sshConfig.privateKey);
        } else {
          config.privateKey = sshConfig.privateKey;
        }
      } catch (error) {
        throw new MCPConnectionError(`Failed to load SSH private key: ${error}`);
      }
    }

    return config;
  }

  private establishSSHConnection(config: ConnectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        reject(new MCPConnectionError('SSH client not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new MCPConnectionError('SSH connection timeout'));
      }, 30000);

      this.sshClient.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.sshClient.on('error', (error) => {
        clearTimeout(timeout);
        reject(new MCPConnectionError(`SSH connection failed: ${error.message}`));
      });

      this.sshClient.connect(config);
    });
  }

  private startMCPProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sshClient || !this.server.sshConfig) {
        reject(new MCPConnectionError('SSH client or config not available'));
        return;
      }

      const command = this.server.sshConfig.command;
      
      this.sshClient.exec(command, (err, stream) => {
        if (err) {
          reject(new MCPConnectionError(`Failed to execute MCP command: ${err.message}`));
          return;
        }

        this.stream = stream;
        this.setupStreamHandlers();
        
        // 스트림이 준비되면 완료
        setTimeout(() => resolve(), 1000);
      });
    });
  }

  private setupStreamHandlers(): void {
    if (!this.stream) return;

    let buffer = '';

    // stdout에서 JSON-RPC 응답 읽기
    this.stream.on('data', (data: Buffer) => {
      buffer += data.toString();
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim());
        }
      }
    });

    // stderr 로깅
    this.stream.stderr?.on('data', (data: Buffer) => {
      this.logger.warn(`MCP SSH stderr: ${data.toString()}`, {
        serverId: this.server.id
      });
    });

    // 스트림 종료 처리
    this.stream.on('close', (code: number, signal: string) => {
      this.logger.info(`MCP SSH stream closed`, {
        serverId: this.server.id,
        code,
        signal
      });
      this.connected = false;
      this.rejectPendingRequests(new MCPConnectionError('SSH stream closed'));
    });

    this.stream.on('error', (error: Error) => {
      this.logError('ssh-stream', error);
      this.connected = false;
      this.rejectPendingRequests(error);
    });
  }

  private handleMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      const response = this.validateJsonRpcResponse(parsed);

      if (response.id && this.messageQueue.has(response.id)) {
        const pending = this.messageQueue.get(response.id)!;
        this.messageQueue.delete(response.id);
        clearTimeout(pending.timeout);
        pending.resolve(response);
      } else {
        this.handleNotification(response);
      }

    } catch (error) {
      this.logger.error('Failed to parse MCP SSH message', {
        serverId: this.server.id,
        message,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handleNotification(message: any): void {
    if (message.method === 'notifications/message') {
      this.logger.info('MCP SSH notification', {
        serverId: this.server.id,
        level: message.params?.level,
        data: message.params?.data
      });
    }
  }

  private rejectPendingRequests(error: Error): void {
    for (const [id, pending] of this.messageQueue) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.messageQueue.clear();
  }

  private async cleanup(): Promise<void> {
    this.rejectPendingRequests(new MCPConnectionError('Connection closed'));
    
    if (this.stream) {
      this.stream.end();
      this.stream.removeAllListeners();
      this.stream = null;
    }

    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient.removeAllListeners();
      this.sshClient = null;
    }
  }
}
/**
 * Stdio Transport 구현
 * 로컬 프로세스와 stdio를 통해 통신
 */

import { spawn, ChildProcess } from 'child_process';
import { MCPTransportType } from '../types';
import { BaseMCPTransport, TransportConfig } from './base-transport';

export interface StdioTransportConfig extends TransportConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export class StdioTransport extends BaseMCPTransport {
  private config: StdioTransportConfig;
  private process?: ChildProcess;
  private buffer: string = '';

  constructor(serverId: string, config: StdioTransportConfig) {
    super(serverId, config);
    this.config = config;
  }

  get type(): MCPTransportType {
    return 'stdio';
  }

  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    this.setStatus('connecting');

    try {
      // 프로세스 생성
      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        cwd: this.config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // stdout 핸들러
      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      // stderr 핸들러
      this.process.stderr?.on('data', (data: Buffer) => {
        console.error(`[${this.serverId}] stderr:`, data.toString());
      });

      // 프로세스 종료 핸들러
      this.process.on('close', (code) => {
        console.log(`[${this.serverId}] Process exited with code ${code}`);
        this.handleDisconnect();
      });

      this.process.on('error', (error) => {
        console.error(`[${this.serverId}] Process error:`, error);
        this.handleDisconnect();
      });

      this.setStatus('connected');

      // 핸드셰이크 수행
      await this.performHandshake();
      console.log(`[${this.serverId}] Connected to MCP server:`, this.serverInfo);
    } catch (error) {
      this.setStatus('error');
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.cleanup();
    this.setStatus('disconnected');
  }

  protected async sendRaw(data: string): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Process not connected');
    }

    return new Promise((resolve, reject) => {
      // JSON-RPC 메시지는 개행으로 구분
      this.process!.stdin!.write(data + '\n', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 버퍼에서 완전한 JSON-RPC 메시지 처리
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    
    // 마지막 라인은 불완전할 수 있으므로 버퍼에 남김
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          this.handleResponse(line);
        } catch (error) {
          console.error(`[${this.serverId}] Failed to process line:`, error);
        }
      }
    }
  }

  private handleDisconnect(): void {
    this.process = undefined;
    this.cleanup();
    this.setStatus('disconnected');
    this.emit('disconnected');
  }
}

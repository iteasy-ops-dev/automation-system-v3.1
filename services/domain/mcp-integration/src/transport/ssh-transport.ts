/**
 * SSH Transport 구현
 * 원격 서버의 MCP 서버와 SSH를 통해 통신
 */

import { Client as SSHClient } from 'ssh2';
import { MCPTransportType } from '../types';
import { BaseMCPTransport, TransportConfig } from './base-transport';

export interface SSHTransportConfig extends TransportConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  command: string;
}

export class SSHTransport extends BaseMCPTransport {
  private config: SSHTransportConfig;
  private sshClient?: SSHClient;
  private stream?: any;
  private buffer: string = '';

  constructor(serverId: string, config: SSHTransportConfig) {
    super(serverId, config);
    this.config = {
      ...config,
      port: config.port || 22
    };
  }

  get type(): MCPTransportType {
    return 'ssh';
  }

  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    this.setStatus('connecting');

    try {
      this.sshClient = new SSHClient();

      await new Promise<void>((resolve, reject) => {
        this.sshClient!.on('ready', () => resolve());
        this.sshClient!.on('error', (err) => reject(err));

        const connectConfig: any = {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username
        };

        if (this.config.privateKey) {
          connectConfig.privateKey = this.config.privateKey;
        } else if (this.config.password) {
          connectConfig.password = this.config.password;
        }

        this.sshClient!.connect(connectConfig);
      });

      // 명령 실행
      await new Promise<void>((resolve, reject) => {
        this.sshClient!.exec(this.config.command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          this.stream = stream;

          stream.on('data', (data: Buffer) => {
            this.buffer += data.toString();
            this.processBuffer();
          });

          stream.stderr.on('data', (data: Buffer) => {
            console.error(`[${this.serverId}] stderr:`, data.toString());
          });

          stream.on('close', () => {
            this.handleDisconnect();
          });

          resolve();
        });
      });

      this.setStatus('connected');

      // 핸드셰이크 수행
      await this.performHandshake();
      console.log(`[${this.serverId}] Connected to MCP server via SSH:`, this.serverInfo);
    } catch (error) {
      this.setStatus('error');
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.stream) {
      this.stream.close();
      this.stream = undefined;
    }
    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient = undefined;
    }
    this.cleanup();
    this.setStatus('disconnected');
  }

  protected async sendRaw(data: string): Promise<void> {
    if (!this.stream) {
      throw new Error('SSH stream not connected');
    }

    return new Promise((resolve, reject) => {
      this.stream.write(data + '\n', (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
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
    this.stream = undefined;
    this.sshClient = undefined;
    this.cleanup();
    this.setStatus('disconnected');
    this.emit('disconnected');
  }
}

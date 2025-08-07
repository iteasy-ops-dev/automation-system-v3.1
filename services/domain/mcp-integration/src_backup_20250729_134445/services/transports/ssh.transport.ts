/**
 * SSH Transport 구현
 * Model Context Protocol - SSH 연결을 통한 통신
 */

import { Client, ConnectConfig } from 'ssh2';
import { BaseTransport, TransportType, TransportStatus } from './base.transport';
import { JsonRpcRequest, JsonRpcResponse } from '../../types';
import { Logger } from '../../utils/logger';

export interface SSHTransportConfig {
  type: TransportType.SSH;
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  command: string;
  args?: string[];
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class SSHTransport extends BaseTransport {
  private logger: Logger;
  private client?: Client;
  private stream?: any;
  private pendingRequests: Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private buffer: string = '';

  constructor(protected config: SSHTransportConfig) {
    super(config);
    this.logger = new Logger(`ssh-transport-${config.host}`);
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    return this.withRetry(async () => {
      this.setStatus(TransportStatus.CONNECTING);
      
      try {
        this.client = new Client();
        
        const connectConfig: ConnectConfig = {
          host: this.config.host,
          port: this.config.port || 22,
          username: this.config.username,
          readyTimeout: this.config.timeout || 30000
        };

        if (this.config.password) {
          connectConfig.password = this.config.password;
        }

        if (this.config.privateKey) {
          connectConfig.privateKey = this.config.privateKey;
        }

        await this.establishConnection(connectConfig);
        await this.executeCommand();

        this.setStatus(TransportStatus.CONNECTED);
        this.emit('connect');
        
        this.logger.info('✅ SSH transport connected', {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          command: this.config.command
        });

      } catch (error) {
        this.setStatus(TransportStatus.ERROR);
        this.logger.error('❌ Failed to connect SSH transport:', error);
        throw error;
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    this.setStatus(TransportStatus.DISCONNECTED);

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    if (this.stream) {
      this.stream.end();
      this.stream = undefined;
    }

    this.client.end();
    this.client = undefined;
    
    this.emit('disconnect');
    this.logger.info('✅ SSH transport disconnected');
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected() || !this.stream) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id as number);
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(request.id as number, {
        resolve,
        reject,
        timer: timeout
      });

      const message = JSON.stringify(request) + '\n';
      
      this.stream.write(message, (error: Error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id as number);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });

      this.logger.debug('📤 Sent JSON-RPC request over SSH', {
        id: request.id,
        method: request.method,
        host: this.config.host
      });
    });
  }

  private async establishConnection(connectConfig: ConnectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client!.on('ready', () => {
        this.logger.debug('🔗 SSH connection established');
        resolve();
      });

      this.client!.on('error', (error) => {
        this.logger.error('❌ SSH connection error:', error);
        reject(error);
      });

      this.client!.on('close', () => {
        this.logger.info('🔚 SSH connection closed');
        this.setStatus(TransportStatus.DISCONNECTED);
        this.emit('disconnect');
      });

      this.client!.connect(connectConfig);
    });
  }

  private async executeCommand(): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `${this.config.command} ${(this.config.args || []).join(' ')}`;
      
      this.client!.exec(command, (err, stream) => {
        if (err) {
          return reject(new Error(`Failed to execute command: ${err.message}`));
        }

        this.stream = stream;
        this.setupStreamHandlers(stream);
        resolve();
      });
    });
  }

  private setupStreamHandlers(stream: any): void {
    stream.on('data', (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    stream.stderr.on('data', (data: Buffer) => {
      this.logger.warn('📢 Remote stderr:', data.toString().trim());
    });

    stream.on('close', (code: number, signal: string) => {
      this.logger.info('🔚 Remote command exited', { code, signal });
      this.setStatus(TransportStatus.DISCONNECTED);
      this.emit('disconnect');
    });

    stream.on('error', (error: Error) => {
      this.logger.error('❌ Stream error:', error);
      this.setStatus(TransportStatus.ERROR);
      this.emit('error', error);
    });
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

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
    this.logger.debug('📥 Received JSON-RPC response over SSH', {
      id: response.id,
      hasResult: !!response.result,
      hasError: !!response.error,
      host: this.config.host
    });

    const pending = this.pendingRequests.get(response.id as number);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(response.id as number);
      pending.resolve(response);
    } else {
      this.logger.warn('⚠️ Received response for unknown request ID:', response.id);
    }
  }
}

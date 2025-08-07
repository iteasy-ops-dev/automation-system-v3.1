/**
 * HTTP Transport 구현
 * HTTP/WebSocket을 통해 MCP 서버와 통신
 */

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { MCPTransportType } from '../types';
import { BaseMCPTransport, TransportConfig } from './base-transport';

export interface HTTPTransportConfig extends TransportConfig {
  url: string;
  headers?: Record<string, string>;
  useWebSocket?: boolean;
}

export class HTTPTransport extends BaseMCPTransport {
  private config: HTTPTransportConfig;
  private httpClient?: AxiosInstance;
  private ws?: WebSocket;
  private buffer: string = '';

  constructor(serverId: string, config: HTTPTransportConfig) {
    super(serverId, config);
    this.config = config;
  }

  get type(): MCPTransportType {
    return 'http';
  }

  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    this.setStatus('connecting');

    try {
      if (this.config.useWebSocket) {
        await this.connectWebSocket();
      } else {
        await this.connectHTTP();
      }

      this.setStatus('connected');

      // 핸드셰이크 수행
      await this.performHandshake();
      console.log(`[${this.serverId}] Connected to MCP server via HTTP:`, this.serverInfo);
    } catch (error) {
      this.setStatus('error');
      await this.disconnect();
      throw error;
    }
  }

  private async connectHTTP(): Promise<void> {
    this.httpClient = axios.create({
      baseURL: this.config.url,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      timeout: this.requestTimeout
    });
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.url.replace(/^http/, 'ws');
      this.ws = new WebSocket(wsUrl, {
        headers: this.config.headers
      });

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.ws.on('error', (error) => {
        console.error(`[${this.serverId}] WebSocket error:`, error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.handleDisconnect();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.httpClient = undefined;
    this.cleanup();
    this.setStatus('disconnected');
  }

  protected async sendRaw(data: string): Promise<void> {
    if (this.ws) {
      return new Promise((resolve, reject) => {
        this.ws!.send(data, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } else if (this.httpClient) {
      // HTTP POST로 전송
      const response = await this.httpClient.post('/', data, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      // 응답 처리
      if (response.data) {
        this.handleResponse(JSON.stringify(response.data));
      }
    } else {
      throw new Error('Not connected');
    }
  }

  private processBuffer(): void {
    if (this.ws) {
      // WebSocket 메시지는 개별적으로 옴
      const messages = this.buffer.split('\n');
      this.buffer = messages.pop() || '';

      for (const message of messages) {
        if (message.trim()) {
          try {
            this.handleResponse(message);
          } catch (error) {
            console.error(`[${this.serverId}] Failed to process message:`, error);
          }
        }
      }
    }
  }

  private handleDisconnect(): void {
    this.ws = undefined;
    this.httpClient = undefined;
    this.cleanup();
    this.setStatus('disconnected');
    this.emit('disconnected');
  }
}

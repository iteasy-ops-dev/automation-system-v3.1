/**
 * HTTP Transport 구현
 * Model Context Protocol - HTTP/HTTPS 통신
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BaseTransport, TransportType, TransportStatus } from './base.transport';
import { JsonRpcRequest, JsonRpcResponse } from '../../types';
import { Logger } from '../../utils/logger';

export interface HTTPTransportConfig {
  type: TransportType.HTTP;
  baseURL: string;
  endpoint?: string;
  headers?: Record<string, string>;
  auth?: {
    username: string;
    password: string;
  } | {
    bearerToken: string;
  };
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  validateSSL?: boolean;
}

export class HTTPTransport extends BaseTransport {
  private logger: Logger;
  private client?: AxiosInstance;

  constructor(protected config: HTTPTransportConfig) { // private → protected
    super(config);
    this.logger = new Logger(`http-transport-${new URL(config.baseURL).hostname}`);
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    return this.withRetry(async () => {
      this.setStatus(TransportStatus.CONNECTING);
      
      try {
        // Axios 클라이언트 설정
        const axiosConfig: AxiosRequestConfig = {
          baseURL: this.config.baseURL,
          timeout: this.config.timeout || 30000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.config.headers
          }
        };

        // SSL 검증 설정
        if (this.config.validateSSL === false) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        // 인증 설정
        if (this.config.auth) {
          if ('username' in this.config.auth) {
            axiosConfig.auth = {
              username: this.config.auth.username,
              password: this.config.auth.password
            };
          } else if ('bearerToken' in this.config.auth) {
            axiosConfig.headers!['Authorization'] = `Bearer ${this.config.auth.bearerToken}`;
          }
        }

        this.client = axios.create(axiosConfig);

        // 응답 인터셉터 설정
        this.setupInterceptors();

        // 연결 테스트 (헬스체크)
        await this.healthCheck();

        this.setStatus(TransportStatus.CONNECTED);
        this.emit('connect');
        
        this.logger.info('✅ HTTP transport connected', {
          baseURL: this.config.baseURL,
          endpoint: this.config.endpoint,
          timeout: this.config.timeout
        });

      } catch (error) {
        this.setStatus(TransportStatus.ERROR);
        this.logger.error('❌ Failed to connect HTTP transport:', error);
        throw error;
      }
    });
  }

  async disconnect(): Promise<void> {
    this.setStatus(TransportStatus.DISCONNECTED);
    this.client = undefined;
    this.emit('disconnect');
    this.logger.info('✅ HTTP transport disconnected');
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Transport not connected');
    }

    try {
      const endpoint = this.config.endpoint || '/';
      
      this.logger.debug('📤 Sending JSON-RPC request over HTTP', {
        id: request.id,
        method: request.method,
        url: `${this.config.baseURL}${endpoint}`
      });

      const response = await this.client.post(endpoint, request);
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonResponse = response.data as JsonRpcResponse;
      
      this.logger.debug('📥 Received JSON-RPC response over HTTP', {
        id: jsonResponse.id,
        hasResult: !!jsonResponse.result,
        hasError: !!jsonResponse.error
      });

      return jsonResponse;

    } catch (error) {
      this.logger.error('❌ Failed to send HTTP request:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error('No response received from server');
        }
      }
      
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  private setupInterceptors(): void {
    if (!this.client) return;

    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('🚀 HTTP request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        this.logger.error('❌ HTTP request error:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('📥 HTTP response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('❌ HTTP response error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  private async healthCheck(): Promise<void> {
    if (!this.client) {
      throw new Error('HTTP client not initialized');
    }

    try {
      // MCP 초기화 요청으로 연결 테스트
      const initRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'automation-system-mcp-integration',
            version: '1.0.0'
          }
        }
      };

      await this.sendRequest(initRequest);
      
    } catch (error) {
      // 일부 MCP 서버는 initialize를 지원하지 않을 수 있으므로
      // 404나 메서드 에러는 연결 성공으로 간주
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn('⚠️ Server does not support initialize method, but connection OK');
        return;
      }
      
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * JSON-RPC Client - MCP Integration Service
 * JSON-RPC 2.0 표준 완전 준수 클라이언트
 * MCP 서버와의 통신 담당
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { Logger } from '../utils/logger';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcError } from '../types';

export interface JsonRpcClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export class JsonRpcClient {
  private logger: Logger;
  private options: Required<JsonRpcClientOptions>;
  private requestId: number = 0;

  constructor(options: JsonRpcClientOptions = {}) {
    this.logger = new Logger('json-rpc-client');
    this.options = {
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Integration-Service/1.0',
        ...options.headers
      }
    };
  }

  /**
   * JSON-RPC 2.0 요청 실행
   */
  async call(
    endpoint: string, 
    method: string, 
    params?: Record<string, any> | any[]
  ): Promise<any> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.generateRequestId()
    };

    this.logger.logJsonRpc('request', request, endpoint);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.retries; attempt++) {
      try {
        const response = await this.executeRequest(endpoint, request);
        
        this.logger.logJsonRpc('response', response, endpoint);

        // 단일 응답 처리
        if (!Array.isArray(response)) {
          if (response.error) {
            throw new JsonRpcClientError(
              response.error.message,
              response.error.code,
              response.error.data
            );
          }

          return response.result;
        }

        // 배치 응답 처리 (현재는 단일 요청만 지원)
        throw new Error('Batch responses not supported in this implementation');
      } catch (error) {
        lastError = error as Error;
        
        this.logger.warn(`JSON-RPC call failed (attempt ${attempt}/${this.options.retries})`, {
          endpoint,
          method,
          error: error.message
        });

        if (attempt < this.options.retries) {
          await this.delay(this.options.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('JSON-RPC call failed after all retries');
  }

  /**
   * 알림 요청 (응답 없음)
   */
  async notify(
    endpoint: string, 
    method: string, 
    params?: Record<string, any> | any[]
  ): Promise<void> {
    const request: Omit<JsonRpcRequest, 'id'> = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.logger.logJsonRpc('request', request, endpoint);

    try {
      await this.executeRequest(endpoint, request);
    } catch (error) {
      this.logger.error(`JSON-RPC notification failed:`, {
        endpoint,
        method,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 배치 요청 처리
   */
  async batch(
    endpoint: string,
    requests: Array<{ method: string; params?: any }>
  ): Promise<any[]> {
    const batchRequest = requests.map(req => ({
      jsonrpc: '2.0' as const,
      method: req.method,
      params: req.params,
      id: this.generateRequestId()
    }));

    this.logger.logJsonRpc('request', batchRequest, endpoint);

    try {
      const responses = await this.executeRequest(endpoint, batchRequest) as JsonRpcResponse[];
      
      this.logger.logJsonRpc('response', responses, endpoint);

      return responses.map(response => {
        if (response.error) {
          throw new JsonRpcClientError(
            response.error.message,
            response.error.code,
            response.error.data
          );
        }
        return response.result;
      });
    } catch (error) {
      this.logger.error(`JSON-RPC batch call failed:`, {
        endpoint,
        requestCount: requests.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * MCP 서버 연결 테스트
   */
  async ping(endpoint: string): Promise<boolean> {
    try {
      await this.call(endpoint, 'ping');
      return true;
    } catch (error) {
      this.logger.debug(`Ping failed for ${endpoint}:`, error.message);
      return false;
    }
  }

  /**
   * MCP 서버 버전 정보 조회
   */
  async getServerInfo(endpoint: string): Promise<any> {
    try {
      return await this.call(endpoint, 'server.info');
    } catch (error) {
      this.logger.error(`Failed to get server info from ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * MCP 서버 도구 목록 조회
   */
  async listTools(endpoint: string): Promise<any[]> {
    try {
      const result = await this.call(endpoint, 'tools.list');
      return Array.isArray(result) ? result : result.tools || [];
    } catch (error) {
      this.logger.error(`Failed to list tools from ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * MCP 도구 실행
   */
  async executeTool(
    endpoint: string, 
    toolName: string, 
    params: Record<string, any>
  ): Promise<any> {
    try {
      return await this.call(endpoint, 'tools.execute', {
        name: toolName,
        parameters: params
      });
    } catch (error) {
      this.logger.error(`Failed to execute tool ${toolName} on ${endpoint}:`, error);
      throw error;
    }
  }

  // Private methods
  private async executeRequest(
    endpoint: string, 
    request: JsonRpcRequest | JsonRpcRequest[] | Omit<JsonRpcRequest, 'id'>
  ): Promise<JsonRpcResponse | JsonRpcResponse[]> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const postData = JSON.stringify(request);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          ...this.options.headers,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.options.timeout
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
              return;
            }

            // 알림의 경우 응답이 없을 수 있음
            if (!data.trim()) {
              resolve({} as JsonRpcResponse);
              return;
            }

            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      });

      req.write(postData);
      req.end();
    });
  }

  private generateRequestId(): number {
    return ++this.requestId;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * JSON-RPC 클라이언트 전용 에러 클래스
 */
export class JsonRpcClientError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: any
  ) {
    super(message);
    this.name = 'JsonRpcClientError';
  }
}
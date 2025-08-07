/**
 * Docker Transport 구현
 * Model Context Protocol - Docker 컨테이너 내 통신
 */

import Docker from 'dockerode';
import { BaseTransport, TransportType, TransportStatus } from './base.transport';
import { JsonRpcRequest, JsonRpcResponse } from '../../types';
import { Logger } from '../../utils/logger';

export interface DockerTransportConfig {
  type: TransportType.DOCKER;
  image: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  workdir?: string;
  volumes?: string[];
  network?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  containerName?: string;
  autoRemove?: boolean;
}

export class DockerTransport extends BaseTransport {
  private logger: Logger;
  private docker?: Docker;
  private container?: Docker.Container;
  private stream?: NodeJS.ReadWriteStream;
  private pendingRequests: Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private buffer: string = '';

  constructor(protected config: DockerTransportConfig) { // private → protected
    super(config);
    this.logger = new Logger(`docker-transport-${config.image}`);
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    return this.withRetry(async () => {
      this.setStatus(TransportStatus.CONNECTING);
      
      try {
        // Docker 클라이언트 초기화
        this.docker = new Docker();

        // 컨테이너 생성 및 시작
        await this.createContainer();
        await this.startContainer();
        
        // 스트림 연결
        await this.attachToContainer();

        this.setStatus(TransportStatus.CONNECTED);
        this.emit('connect');
        
        this.logger.info('✅ Docker transport connected', {
          image: this.config.image,
          containerId: this.container?.id,
          command: this.config.command
        });

      } catch (error) {
        this.setStatus(TransportStatus.ERROR);
        this.logger.error('❌ Failed to connect Docker transport:', error);
        throw error;
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.container) {
      return;
    }

    this.setStatus(TransportStatus.DISCONNECTED);

    // 대기 중인 요청들 취소
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    // 스트림 종료
    if (this.stream) {
      this.stream.end();
      this.stream = undefined;
    }

    // 컨테이너 정지 및 삭제
    try {
      await this.container.stop();
      
      if (this.config.autoRemove !== false) {
        await this.container.remove();
      }
    } catch (error) {
      this.logger.warn('⚠️ Error stopping/removing container:', error);
    }

    this.container = undefined;
    this.docker = undefined;
    
    this.emit('disconnect');
    this.logger.info('✅ Docker transport disconnected');
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected() || !this.stream) {
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
      
      this.stream!.write(message, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });

      this.logger.debug('📤 Sent JSON-RPC request to Docker container', {
        id: request.id,
        method: request.method,
        containerId: this.container?.id
      });
    });
  }

  private async createContainer(): Promise<void> {
    if (!this.docker) {
      throw new Error('Docker client not initialized');
    }

    const createOptions: Docker.ContainerCreateOptions = {
      Image: this.config.image,
      Cmd: this.config.command ? [this.config.command, ...(this.config.args || [])] : undefined,
      Env: this.config.env ? Object.entries(this.config.env).map(([k, v]) => `${k}=${v}`) : undefined,
      WorkingDir: this.config.workdir,
      HostConfig: {
        AutoRemove: this.config.autoRemove !== false,
        NetworkMode: this.config.network || 'bridge'
      },
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: false,
      Tty: false
    };

    // 볼륨 마운트 설정
    if (this.config.volumes && this.config.volumes.length > 0) {
      createOptions.HostConfig!.Binds = this.config.volumes;
    }

    // 컨테이너 이름 설정
    if (this.config.containerName) {
      createOptions.name = this.config.containerName;
    }

    this.container = await this.docker.createContainer(createOptions);
    
    this.logger.debug('🐳 Docker container created', {
      containerId: this.container.id,
      image: this.config.image
    });
  }

  private async startContainer(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not created');
    }

    await this.container.start();
    
    this.logger.debug('▶️ Docker container started', {
      containerId: this.container.id
    });

    // 컨테이너 이벤트 리스너 설정
    this.container.wait((err, data) => {
      if (err) {
        this.logger.error('❌ Container wait error:', err);
        this.setStatus(TransportStatus.ERROR);
        this.emit('error', err);
      } else {
        this.logger.info('🔚 Container exited', data);
        this.setStatus(TransportStatus.DISCONNECTED);
        this.emit('disconnect');
      }
    });
  }

  private async attachToContainer(): Promise<void> {
    if (!this.container) {
      throw new Error('Container not created');
    }

    const stream = await this.container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true
    });

    this.stream = stream;
    this.setupStreamHandlers(stream);
    
    this.logger.debug('🔗 Attached to Docker container', {
      containerId: this.container.id
    });
  }

  private setupStreamHandlers(stream: NodeJS.ReadWriteStream): void {
    // Docker의 multiplexed stream 처리
    stream.on('data', (data: Buffer) => {
      // Docker는 stdout/stderr를 multiplexed stream으로 전송
      // 첫 8바이트는 헤더 (stream type, size)
      let offset = 0;
      
      while (offset < data.length) {
        if (offset + 8 > data.length) break;
        
        const streamType = data[offset];
        const size = data.readUInt32BE(offset + 4);
        
        if (offset + 8 + size > data.length) break;
        
        const content = data.slice(offset + 8, offset + 8 + size).toString();
        
        if (streamType === 1) { // stdout
          this.handleStdout(content);
        } else if (streamType === 2) { // stderr
          this.logger.warn('📢 Container stderr:', content.trim());
        }
        
        offset += 8 + size;
      }
    });

    stream.on('error', (error) => {
      this.logger.error('❌ Stream error:', error);
      this.setStatus(TransportStatus.ERROR);
      this.emit('error', error);
    });

    stream.on('end', () => {
      this.logger.info('🔚 Stream ended');
      this.setStatus(TransportStatus.DISCONNECTED);
      this.emit('disconnect');
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
    this.logger.debug('📥 Received JSON-RPC response from Docker container', {
      id: response.id,
      hasResult: !!response.result,
      hasError: !!response.error,
      containerId: this.container?.id
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
}

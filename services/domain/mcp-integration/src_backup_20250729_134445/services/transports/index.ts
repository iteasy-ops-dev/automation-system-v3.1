/**
 * Transport Factory - 다양한 Transport 생성 및 관리
 */

import { BaseTransport, TransportType, TransportConfig } from './base.transport';
import { StdioTransport, StdioTransportConfig } from './stdio.transport';
import { SSHTransport, SSHTransportConfig } from './ssh.transport';
import { HTTPTransport, HTTPTransportConfig } from './http.transport';
import { DockerTransport, DockerTransportConfig } from './docker.transport';

export type AnyTransportConfig = 
  | StdioTransportConfig 
  | SSHTransportConfig 
  | HTTPTransportConfig 
  | DockerTransportConfig;

export class TransportFactory {
  /**
   * Transport 인스턴스 생성
   */
  static create(config: AnyTransportConfig): BaseTransport {
    switch (config.type) {
      case TransportType.STDIO:
        return new StdioTransport(config as StdioTransportConfig);
        
      case TransportType.SSH:
        return new SSHTransport(config as SSHTransportConfig);
        
      case TransportType.HTTP:
        return new HTTPTransport(config as HTTPTransportConfig);
        
      case TransportType.DOCKER:
        return new DockerTransport(config as DockerTransportConfig);
        
      default:
        throw new Error(`Unsupported transport type: ${(config as any).type}`);
    }
  }

  /**
   * 지원되는 Transport 타입 목록
   */
  static getSupportedTypes(): TransportType[] {
    return [
      TransportType.STDIO,
      TransportType.SSH,
      TransportType.HTTP,
      TransportType.DOCKER
    ];
  }

  /**
   * Transport 설정 검증
   */
  static validateConfig(config: AnyTransportConfig): void {
    if (!config.type) {
      throw new Error('Transport type is required');
    }

    if (!this.getSupportedTypes().includes(config.type)) {
      throw new Error(`Unsupported transport type: ${config.type}`);
    }

    // 타입별 필수 필드 검증
    switch (config.type) {
      case TransportType.STDIO:
        const stdioConfig = config as StdioTransportConfig;
        if (!stdioConfig.command) {
          throw new Error('STDIO transport requires command');
        }
        break;

      case TransportType.SSH:
        const sshConfig = config as SSHTransportConfig;
        if (!sshConfig.host || !sshConfig.username || !sshConfig.command) {
          throw new Error('SSH transport requires host, username, and command');
        }
        if (!sshConfig.password && !sshConfig.privateKey) {
          throw new Error('SSH transport requires either password or privateKey');
        }
        break;

      case TransportType.HTTP:
        const httpConfig = config as HTTPTransportConfig;
        if (!httpConfig.baseURL) {
          throw new Error('HTTP transport requires baseURL');
        }
        try {
          new URL(httpConfig.baseURL);
        } catch {
          throw new Error('HTTP transport baseURL must be a valid URL');
        }
        break;

      case TransportType.DOCKER:
        const dockerConfig = config as DockerTransportConfig;
        if (!dockerConfig.image) {
          throw new Error('Docker transport requires image');
        }
        break;
    }
  }
}

// Transport 타입들 내보내기
export {
  BaseTransport,
  TransportType,
  TransportStatus,
  TransportConfig
} from './base.transport';

export {
  StdioTransport,
  StdioTransportConfig
} from './stdio.transport';

export {
  SSHTransport,
  SSHTransportConfig
} from './ssh.transport';

export {
  HTTPTransport,
  HTTPTransportConfig
} from './http.transport';

export {
  DockerTransport,
  DockerTransportConfig
} from './docker.transport';

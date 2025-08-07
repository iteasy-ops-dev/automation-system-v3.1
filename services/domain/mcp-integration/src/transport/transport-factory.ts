/**
 * MCP Transport Factory
 * Transport 타입에 따라 적절한 구현체 생성
 */

import { 
  MCPServer, 
  MCPServerCreate, 
  MCPTransportType,
  MCPValidationError 
} from '../types';
import { BaseMCPTransport } from './base-transport';
import { StdioTransport, StdioTransportConfig } from './stdio-transport';
import { SSHTransport, SSHTransportConfig } from './ssh-transport';
import { HTTPTransport, HTTPTransportConfig } from './http-transport';

export class MCPTransportFactory {
  /**
   * MCP 서버 설정에 따라 적절한 Transport 생성
   */
  static createTransport(server: MCPServer): BaseMCPTransport {
    switch (server.transport) {
      case 'stdio':
        return this.createStdioTransport(server);
      
      case 'ssh':
        return this.createSSHTransport(server);
      
      case 'http':
        return this.createHTTPTransport(server);
      
      case 'docker':
        // TODO: Docker transport 구현
        throw new MCPValidationError('Docker transport not yet implemented');
      
      default:
        throw new MCPValidationError(`Unknown transport type: ${server.transport}`);
    }
  }

  /**
   * 서버 생성 요청 검증
   */
  static validateConfig(config: MCPServerCreate): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new MCPValidationError('Server name is required');
    }

    if (!config.transport) {
      throw new MCPValidationError('Transport type is required');
    }

    switch (config.transport) {
      case 'stdio':
        if (!config.command) {
          throw new MCPValidationError('Command is required for stdio transport');
        }
        break;
      
      case 'ssh':
        if (!config.sshConfig) {
          throw new MCPValidationError('SSH config is required for ssh transport');
        }
        if (!config.sshConfig.host || !config.sshConfig.username) {
          throw new MCPValidationError('Host and username are required for SSH');
        }
        if (!config.sshConfig.password && !config.sshConfig.privateKey) {
          throw new MCPValidationError('Either password or private key is required for SSH');
        }
        if (!config.command) {
          throw new MCPValidationError('Command is required for ssh transport');
        }
        break;
      
      case 'http':
        if (!config.httpConfig) {
          throw new MCPValidationError('HTTP config is required for http transport');
        }
        if (!config.httpConfig.url) {
          throw new MCPValidationError('URL is required for http transport');
        }
        break;
      
      case 'docker':
        if (!config.dockerConfig) {
          throw new MCPValidationError('Docker config is required for docker transport');
        }
        if (!config.dockerConfig.image && !config.dockerConfig.container) {
          throw new MCPValidationError('Either image or container is required for docker transport');
        }
        break;
      
      default:
        throw new MCPValidationError(`Unknown transport type: ${config.transport}`);
    }
  }

  private static createStdioTransport(server: MCPServer): StdioTransport {
    const config: StdioTransportConfig = {
      command: server.command!,
      args: server.args
    };
    
    return new StdioTransport(server.id, config);
  }

  private static createSSHTransport(server: MCPServer): SSHTransport {
    if (!server.sshConfig) {
      throw new MCPValidationError('SSH config missing');
    }

    const config: SSHTransportConfig = {
      host: server.sshConfig.host,
      port: server.sshConfig.port,
      username: server.sshConfig.username,
      password: server.sshConfig.password,
      privateKey: server.sshConfig.privateKey,
      command: server.command!
    };
    
    return new SSHTransport(server.id, config);
  }

  private static createHTTPTransport(server: MCPServer): HTTPTransport {
    if (!server.httpConfig) {
      throw new MCPValidationError('HTTP config missing');
    }

    const config: HTTPTransportConfig = {
      url: server.httpConfig.url,
      headers: server.httpConfig.headers,
      useWebSocket: server.httpConfig.useWebSocket
    };
    
    return new HTTPTransport(server.id, config);
  }
}

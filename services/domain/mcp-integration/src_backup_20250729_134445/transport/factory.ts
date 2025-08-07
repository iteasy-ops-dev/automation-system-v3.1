/**
 * MCP Transport Factory
 * 서버 타입에 따른 적절한 Transport 인스턴스 생성
 */

import { MCPServer, MCPConnectionError } from '../types';
import { BaseMCPTransport } from './base-transport';
import { StdioTransport } from './stdio-transport';
import { SSHTransport } from './ssh-transport';
import { DockerTransport } from './docker-transport';
import { HTTPTransport } from './http-transport';
import { Logger } from '../utils/logger';

export class MCPTransportFactory {
  private static logger = Logger.getInstance();

  /**
   * MCP 서버 설정에 따른 Transport 생성
   */
  static createTransport(server: MCPServer): BaseMCPTransport {
    try {
      switch (server.transport) {
        case 'stdio':
          return new StdioTransport(server);
          
        case 'ssh':
          return new SSHTransport(server);
          
        case 'docker':
          return new DockerTransport(server);
          
        case 'http':
          return new HTTPTransport(server);
          
        default:
          throw new MCPConnectionError(
            `Unsupported transport type: ${server.transport}`
          );
      }
    } catch (error) {
      this.logger.error('Failed to create MCP transport', {
        serverId: server.id,
        serverName: server.name,
        transport: server.transport,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }  /**
   * Transport 설정 검증
   */
  static validateTransportConfig(server: MCPServer): void {
    switch (server.transport) {
      case 'stdio':
        if (!server.command) {
          throw new MCPConnectionError('Stdio transport requires command');
        }
        break;
        
      case 'ssh':
        if (!server.sshConfig) {
          throw new MCPConnectionError('SSH transport requires sshConfig');
        }
        
        const { host, username, command } = server.sshConfig;
        if (!host || !username || !command) {
          throw new MCPConnectionError(
            'SSH transport requires host, username, and command'
          );
        }
        
        if (!server.sshConfig.password && !server.sshConfig.privateKey) {
          throw new MCPConnectionError(
            'SSH transport requires either password or privateKey'
          );
        }
        break;
        
      case 'docker':
        if (!server.dockerConfig || !server.dockerConfig.image) {
          throw new MCPConnectionError('Docker transport requires image');
        }
        break;
        
      case 'http':
        if (!server.httpConfig || !server.httpConfig.url) {
          throw new MCPConnectionError('HTTP transport requires URL');
        }
        
        try {
          new URL(server.httpConfig.url);
        } catch (error) {
          throw new MCPConnectionError('HTTP transport requires valid URL');
        }
        break;
        
      default:
        throw new MCPConnectionError(
          `Unsupported transport type: ${server.transport}`
        );
    }
  }

  /**
   * Transport 기능 테스트
   */
  static async testTransport(server: MCPServer): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      this.validateTransportConfig(server);
      
      const transport = this.createTransport(server);
      
      await transport.connect();
      
      // 기본적인 ping 테스트
      const pingResponse = await transport.send({
        jsonrpc: '2.0',
        method: 'ping',
        id: 'test-ping'
      });
      
      await transport.disconnect();
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime
      };
    }
  }
}
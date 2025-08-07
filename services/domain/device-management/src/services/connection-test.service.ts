/**
 * Connection Test Service - 실제 장비 연결 테스트 구현
 * 다양한 프로토콜 지원 (SSH, HTTP/HTTPS, SNMP)
 */

import { NodeSSH } from 'node-ssh';
import axios from 'axios';
import * as snmp from 'net-snmp';
import * as ping from 'ping';
import { DeviceConnectionInfo, ConnectionTestResult } from '../types';
import { Logger } from '../utils/logger';

export class ConnectionTestService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ConnectionTestService');
  }

  /**
   * 연결 테스트 실행 (프로토콜별 분기)
   */
  async testConnection(connectionInfo: DeviceConnectionInfo): Promise<ConnectionTestResult> {
    this.logger.info('Starting connection test', { 
      protocol: connectionInfo.protocol, 
      host: connectionInfo.host,
      port: connectionInfo.port 
    });

    // 먼저 호스트 핑 테스트
    const pingResult = await this.pingHost(connectionInfo.host);
    if (!pingResult.alive) {
      return {
        success: false,
        protocol: connectionInfo.protocol,
        responseTime: pingResult.time || 0,
        error: 'Host is not reachable',
        errorCode: 'HOST_UNREACHABLE'
      };
    }

    // 프로토콜별 연결 테스트
    switch (connectionInfo.protocol) {
      case 'ssh':
        return await this.testSSHConnection(connectionInfo);
      case 'http':
      case 'https':
        return await this.testHTTPConnection(connectionInfo);
      case 'snmp':
        return await this.testSNMPConnection(connectionInfo);
      default:
        return {
          success: false,
          protocol: connectionInfo.protocol,
          responseTime: 0,
          error: `Unsupported protocol: ${connectionInfo.protocol}`,
          errorCode: 'UNSUPPORTED_PROTOCOL'
        };
    }
  }

  /**
   * 호스트 핑 테스트
   */
  private async pingHost(host: string): Promise<{ alive: boolean; time?: number }> {
    try {
      const result = await ping.promise.probe(host, {
        timeout: 5,
        attempts: 2
      });
      return { 
        alive: result.alive, 
        time: result.time ? parseFloat(result.time) : undefined 
      };
    } catch (error) {
      this.logger.error('Ping failed', error);
      return { alive: false };
    }
  }

  /**
   * SSH 연결 테스트
   */
  private async testSSHConnection(connectionInfo: DeviceConnectionInfo): Promise<ConnectionTestResult> {
    const ssh = new NodeSSH();
    const startTime = Date.now();
    
    try {
      // SSH 연결 설정
      const connectConfig: any = {
        host: connectionInfo.host,
        port: connectionInfo.port || 22,
        username: connectionInfo.username,
        timeout: (connectionInfo.timeout || 30) * 1000,
        readyTimeout: (connectionInfo.timeout || 30) * 1000,
        tryKeyboard: false
      };

      // 인증 방식 설정
      if (connectionInfo.privateKey) {
        connectConfig.privateKey = connectionInfo.privateKey;
      } else if (connectionInfo.password) {
        connectConfig.password = connectionInfo.password;
      } else {
        throw new Error('No authentication method provided');
      }

      // SSH 연결
      await ssh.connect(connectConfig);
      
      // 실제 명령 실행으로 서버 정보 가져오기
      const unameResult = await ssh.execCommand('uname -a');
      const uptimeResult = await ssh.execCommand('uptime');
      
      // SSH 연결 종료
      ssh.dispose();
      
      const responseTime = Date.now() - startTime;
      
      this.logger.logSuccess('SSH connection test successful', {
        host: connectionInfo.host,
        responseTime
      });

      return {
        success: true,
        protocol: 'ssh',
        responseTime,
        details: {
          serverInfo: unameResult.stdout.trim(),
          uptime: uptimeResult.stdout.trim(),
          sshOutput: {
            uname: unameResult.stdout.trim(),
            uptime: uptimeResult.stdout.trim()
          }
        }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error('SSH connection test failed', error);

      // 에러 코드 분류
      let errorCode = 'SSH_CONNECTION_FAILED';
      if (error.message?.includes('Authentication failed')) {
        errorCode = 'SSH_AUTH_FAILED';
      } else if (error.message?.includes('ECONNREFUSED')) {
        errorCode = 'SSH_CONNECTION_REFUSED';
      } else if (error.message?.includes('ETIMEDOUT') || error.message?.includes('Timed out')) {
        errorCode = 'SSH_TIMEOUT';
      }

      return {
        success: false,
        protocol: 'ssh',
        responseTime,
        error: error.message || 'SSH connection failed',
        errorCode
      };
    }
  }

  /**
   * HTTP/HTTPS 연결 테스트
   */
  private async testHTTPConnection(connectionInfo: DeviceConnectionInfo): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const url = `${connectionInfo.protocol}://${connectionInfo.host}:${connectionInfo.port || (connectionInfo.protocol === 'https' ? 443 : 80)}`;
    
    try {
      const response = await axios({
        method: 'GET',
        url,
        timeout: (connectionInfo.timeout || 30) * 1000,
        validateStatus: () => true, // 모든 상태 코드 허용
        auth: connectionInfo.username && connectionInfo.password ? {
          username: connectionInfo.username,
          password: connectionInfo.password
        } : undefined,
        httpsAgent: connectionInfo.protocol === 'https' ? new (require('https')).Agent({
          rejectUnauthorized: false // 자체 서명 인증서 허용
        }) : undefined
      });
      
      const responseTime = Date.now() - startTime;
      const success = response.status < 500;
      
      this.logger.info('HTTP connection test completed', {
        url,
        status: response.status,
        success,
        responseTime
      });

      return {
        success,
        protocol: connectionInfo.protocol,
        responseTime,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
          server: response.headers['server'],
          contentType: response.headers['content-type'],
          headers: response.headers
        }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error('HTTP connection test failed', error);

      let errorCode = 'HTTP_CONNECTION_FAILED';
      if (error.code === 'ECONNREFUSED') {
        errorCode = 'HTTP_CONNECTION_REFUSED';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorCode = 'HTTP_TIMEOUT';
      } else if (error.response?.status === 401) {
        errorCode = 'HTTP_AUTH_FAILED';
      }

      return {
        success: false,
        protocol: connectionInfo.protocol,
        responseTime,
        error: error.message || 'HTTP connection failed',
        errorCode
      };
    }
  }

  /**
   * SNMP 연결 테스트
   */
  private async testSNMPConnection(connectionInfo: DeviceConnectionInfo): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const session = snmp.createSession(
        connectionInfo.host, 
        connectionInfo.username || 'public',
        {
          port: connectionInfo.port || 161,
          timeout: (connectionInfo.timeout || 5) * 1000,
          version: snmp.Version2c
        }
      );

      // sysDescr OID 조회
      const oid = '1.3.6.1.2.1.1.1.0';
      
      session.get([oid], (error: any, varbinds: any) => {
        const responseTime = Date.now() - startTime;
        session.close();

        if (error) {
          this.logger.error('SNMP connection test failed', error);
          
          let errorCode = 'SNMP_CONNECTION_FAILED';
          if (error.message?.includes('Timeout')) {
            errorCode = 'SNMP_TIMEOUT';
          } else if (error.message?.includes('Unknown host')) {
            errorCode = 'SNMP_UNKNOWN_HOST';
          }

          resolve({
            success: false,
            protocol: 'snmp',
            responseTime,
            error: error.message || 'SNMP connection failed',
            errorCode
          });
        } else {
          const sysDescr = varbinds[0]?.value?.toString() || 'Unknown';
          
          this.logger.logSuccess('SNMP connection test successful', {
            host: connectionInfo.host,
            responseTime
          });

          resolve({
            success: true,
            protocol: 'snmp',
            responseTime,
            details: {
              systemDescription: sysDescr,
              oid: oid,
              community: connectionInfo.username || 'public'
            }
          });
        }
      });
    });
  }
}

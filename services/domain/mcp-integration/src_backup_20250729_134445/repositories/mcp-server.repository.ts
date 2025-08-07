/**
 * MCP Server Repository - Model Context Protocol 표준 준수
 * shared/contracts/v1.0/rest/domain/mcp-service.yaml 계약 100% 준수
 * Prisma 기반으로 완전한 타입 안전성 보장
 */

import { PrismaClient, McpServer, Prisma } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';
import { 
  MCPServerFilter, 
  MCPServerCreate, 
  MCPServerUpdate,
  MCPServer,
  MCPServerListResponse,
  MCPConnectionError
} from '../types';

export class MCPServerRepository {
  private readonly logger: Logger = new Logger('MCPServerRepository');
  private readonly cachePrefix = 'mcp-server';
  private readonly cacheTTL = 300; // 5분

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheService
  ) {}

  /**
   * MCP 서버 목록 조회
   * GET /api/v1/mcp/servers 지원
   */
  async findServers(filters: MCPServerFilter): Promise<MCPServerListResponse> {
    try {
      // 캐시 키 생성
      const cacheKey = this.getListCacheKey(filters);
      this.logger.debug('Attempting cache lookup', { filters, cacheKey });
      
      const cached = await this.cache.get<MCPServerListResponse>(cacheKey);
      
      if (cached && this.isValidCachedResponse(cached)) {
        this.logger.debug('MCP server list cache hit', { 
          filters, 
          cacheKey,
          total: cached.total
        });
        return cached;
      }

      // 캐시 미스 - 데이터베이스 조회
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy();
      
      // 병렬로 데이터와 총 개수 조회
      const [servers, total] = await Promise.all([
        this.prisma.mcpServer.findMany({
          where,
          orderBy,
          skip: filters.offset || 0,
          take: filters.limit || 20
        }),
        this.prisma.mcpServer.count({ where })
      ]);

      // 응답 객체 생성
      const response: MCPServerListResponse = {
        items: servers.map(server => this.mapToMCPServer(server)),
        total,
        limit: filters.limit || 20,
        offset: filters.offset || 0
      };

      // 캐시 저장 (30초 TTL)
      await this.cache.setex(cacheKey, 30, response);

      this.logger.info('MCP server list retrieved from database', {
        filters,
        total,
        itemCount: servers.length
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to find MCP servers', { 
        filters, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new MCPConnectionError(`Failed to retrieve MCP servers: ${error}`);
    }
  }  /**
   * MCP 서버 생성
   * POST /api/v1/mcp/servers 지원
   */
  async createServer(data: MCPServerCreate): Promise<MCPServer> {
    try {
      this.logger.info('Creating MCP server', { serverName: data.name, transport: data.transport });

      // Transport별 설정 검증
      this.validateTransportConfig(data);

      // 서버명 중복 확인
      const existing = await this.prisma.mcpServer.findFirst({
        where: { name: data.name }
      });

      if (existing) {
        throw new MCPConnectionError(`MCP server with name '${data.name}' already exists`);
      }

      // Prisma 모델에 맞게 데이터 변환
      const prismaData = this.mapToPrismaCreate(data);
      
      // 서버 생성
      const server = await this.prisma.mcpServer.create({
        data: prismaData
      });

      // 캐시 무효화
      await this.invalidateCache();

      const result = this.mapToMCPServer(server);
      
      this.logger.info('MCP server created successfully', {
        serverId: result.id,
        serverName: result.name,
        transport: result.transport
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create MCP server', {
        serverName: data.name,
        transport: data.transport,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof MCPConnectionError) {
        throw error;
      }
      throw new MCPConnectionError(`Failed to create MCP server: ${error}`);
    }
  }

  /**
   * MCP 서버 조회 (ID)
   * GET /api/v1/mcp/servers/{id} 지원
   */
  async findById(id: string): Promise<MCPServer | null> {
    try {
      const cacheKey = `${this.cachePrefix}:${id}`;
      
      // 캐시 조회
      const cached = await this.cache.get<MCPServer>(cacheKey);
      if (cached && this.isValidMCPServer(cached)) {
        this.logger.debug('MCP server cache hit', { serverId: id });
        return cached;
      }

      // 데이터베이스 조회
      const server = await this.prisma.mcpServer.findUnique({
        where: { id }
      });

      if (!server) {
        this.logger.debug('MCP server not found', { serverId: id });
        return null;
      }

      const result = this.mapToMCPServer(server);
      
      // 캐시 저장
      await this.cache.setex(cacheKey, this.cacheTTL, result);

      this.logger.debug('MCP server found', { serverId: id, serverName: result.name });
      return result;
    } catch (error) {
      this.logger.error('Failed to find MCP server by ID', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new MCPConnectionError(`Failed to find MCP server: ${error}`);
    }
  }  /**
   * MCP 서버 수정
   * PUT /api/v1/mcp/servers/{id} 지원
   */
  async updateServer(id: string, data: MCPServerUpdate): Promise<MCPServer> {
    try {
      this.logger.info('Updating MCP server', { serverId: id, updates: Object.keys(data) });

      // 서버 존재 확인
      const existing = await this.findById(id);
      if (!existing) {
        throw new MCPConnectionError(`MCP server with ID '${id}' not found`);
      }

      // 서버명 중복 확인 (변경하는 경우)
      if (data.name && data.name !== existing.name) {
        const nameExists = await this.prisma.mcpServer.findFirst({
          where: { 
            name: data.name,
            id: { not: id }
          }
        });

        if (nameExists) {
          throw new MCPConnectionError(`MCP server with name '${data.name}' already exists`);
        }
      }

      // Prisma 데이터 변환
      const updateData = this.mapToPrismaUpdate(data);
      
      // 서버 업데이트
      const server = await this.prisma.mcpServer.update({
        where: { id },
        data: updateData
      });

      // 캐시 무효화
      await this.invalidateServerCache(id);

      const result = this.mapToMCPServer(server);
      
      this.logger.info('MCP server updated successfully', {
        serverId: id,
        serverName: result.name
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to update MCP server', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof MCPConnectionError) {
        throw error;
      }
      throw new MCPConnectionError(`Failed to update MCP server: ${error}`);
    }
  }

  /**
   * MCP 서버 삭제
   * DELETE /api/v1/mcp/servers/{id} 지원
   */
  async deleteServer(id: string): Promise<boolean> {
    try {
      this.logger.info('Deleting MCP server', { serverId: id });

      // 서버 존재 확인
      const existing = await this.findById(id);
      if (!existing) {
        return false;
      }

      // 서버 삭제
      await this.prisma.mcpServer.delete({
        where: { id }
      });

      // 캐시 무효화
      await this.invalidateServerCache(id);

      this.logger.info('MCP server deleted successfully', {
        serverId: id,
        serverName: existing.name
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to delete MCP server', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new MCPConnectionError(`Failed to delete MCP server: ${error}`);
    }
  }  /**
   * 서버 상태 업데이트 (연결 상태 및 마지막 헬스체크)
   */
  async updateServerStatus(id: string, status: 'active' | 'inactive' | 'error', 
                          connectionStatus?: 'connected' | 'disconnected' | 'connecting' | 'error',
                          lastError?: string): Promise<void> {
    try {
      const updateData: Prisma.McpServerUpdateInput = {
        status,
        lastHealthCheck: new Date(),
        updatedAt: new Date()
      };

      if (connectionStatus) {
        updateData.connectionStatus = connectionStatus;
      }

      if (lastError) {
        updateData.lastError = lastError;
      }

      await this.prisma.mcpServer.update({
        where: { id },
        data: updateData
      });

      // 캐시 무효화
      await this.invalidateServerCache(id);

      this.logger.debug('MCP server status updated', {
        serverId: id,
        status,
        connectionStatus,
        hasError: !!lastError
      });
    } catch (error) {
      this.logger.error('Failed to update server status', {
        serverId: id,
        status,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 서버 정보 업데이트 (MCP 핸드셰이크 정보)
   */
  async updateServerInfo(id: string, serverInfo: any): Promise<void> {
    try {
      await this.prisma.mcpServer.update({
        where: { id },
        data: {
          serverInfo: JSON.stringify(serverInfo),
          updatedAt: new Date()
        }
      });

      // 캐시 무효화
      await this.invalidateServerCache(id);

      this.logger.debug('MCP server info updated', {
        serverId: id,
        serverInfo
      });
    } catch (error) {
      this.logger.error('Failed to update server info', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }  /**
   * 캐시된 응답 유효성 검증
   */
  private isValidCachedResponse(cached: any): cached is MCPServerListResponse {
    return cached && 
           typeof cached === 'object' && 
           'items' in cached && 
           'total' in cached &&
           Array.isArray(cached.items);
  }

  /**
   * MCPServer 객체 유효성 검증
   */
  private isValidMCPServer(cached: any): cached is MCPServer {
    return cached && 
           typeof cached === 'object' && 
           'id' in cached && 
           'name' in cached &&
           'transport' in cached;
  }

  /**
   * Where 조건 구성
   */
  private buildWhereClause(filters: MCPServerFilter): Prisma.McpServerWhereInput {
    const where: Prisma.McpServerWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.transport) {
      where.transport = filters.transport;
    }

    return where;
  }

  /**
   * 정렬 조건 구성
   */
  private buildOrderBy(): Prisma.McpServerOrderByWithRelationInput[] {
    return [
      { createdAt: 'desc' },
      { name: 'asc' }
    ];
  }

  /**
   * 캐시 키 생성
   */
  private getListCacheKey(filters: MCPServerFilter): string {
    const key = [
      this.cachePrefix,
      'list',
      filters.status || 'all',
      filters.transport || 'all',
      filters.limit || 20,
      filters.offset || 0
    ].join(':');
    
    return key;
  }  /**
   * Prisma McpServer → MCPServer 변환 (완전한 null 안전성 보장)
   */
  private mapToMCPServer(server: McpServer): MCPServer {
    return {
      id: server.id,
      name: server.name,
      description: server.description || undefined,
      transport: server.transport as any, // Transport enum 맞춤
      status: server.status as any, // Status enum 맞춤
      connectionStatus: (server.connectionStatus as any) || 'disconnected',
      
      // Transport별 설정 (안전한 파싱)
      command: server.command || undefined,
      args: server.args ? this.safeJsonParse(server.args, []) : undefined,
      sshConfig: server.sshConfig ? this.safeJsonParse(server.sshConfig, null) : undefined,
      dockerConfig: server.dockerConfig ? this.safeJsonParse(server.dockerConfig, null) : undefined,
      httpConfig: server.httpConfig ? this.safeJsonParse(server.httpConfig, null) : undefined,
      
      // MCP 서버 정보
      serverInfo: server.serverInfo ? this.safeJsonParse(server.serverInfo, null) : undefined,
      
      metadata: server.metadata ? this.safeJsonParse(server.metadata, {}) : {},
      
      // 날짜 필드 안전 변환
      createdAt: server.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: server.updatedAt?.toISOString() || new Date().toISOString(),
      lastHealthCheck: server.lastHealthCheck?.toISOString() || undefined,
      lastError: server.lastError || undefined
    };
  }

  /**
   * MCPServerCreate → Prisma 생성 데이터 변환
   */
  private mapToPrismaCreate(data: MCPServerCreate): Prisma.McpServerCreateInput {
    const prismaData: Prisma.McpServerCreateInput = {
      name: data.name,
      description: data.description,
      transport: data.transport,
      status: 'inactive', // 초기 상태
      connectionStatus: 'disconnected',
      
      // Transport별 설정
      command: data.command,
      args: data.args ? JSON.stringify(data.args) : null,
      sshConfig: data.sshConfig ? JSON.stringify(data.sshConfig) : null,
      dockerConfig: data.dockerConfig ? JSON.stringify(data.dockerConfig) : null,
      httpConfig: data.httpConfig ? JSON.stringify(data.httpConfig) : null,
      
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return prismaData;
  }

  /**
   * MCPServerUpdate → Prisma 업데이트 데이터 변환
   */
  private mapToPrismaUpdate(data: MCPServerUpdate): Prisma.McpServerUpdateInput {
    const updateData: Prisma.McpServerUpdateInput = {
      updatedAt: new Date()
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.metadata !== undefined) {
      updateData.metadata = JSON.stringify(data.metadata);
    }

    return updateData;
  }  /**
   * Transport 설정 검증
   */
  private validateTransportConfig(data: MCPServerCreate): void {
    switch (data.transport) {
      case 'stdio':
        if (!data.command) {
          throw new MCPConnectionError('Stdio transport requires command');
        }
        break;
        
      case 'ssh':
        if (!data.sshConfig) {
          throw new MCPConnectionError('SSH transport requires sshConfig');
        }
        
        const { host, username, command } = data.sshConfig;
        if (!host || !username || !command) {
          throw new MCPConnectionError(
            'SSH transport requires host, username, and command'
          );
        }
        
        if (!data.sshConfig.password && !data.sshConfig.privateKey) {
          throw new MCPConnectionError(
            'SSH transport requires either password or privateKey'
          );
        }
        break;
        
      case 'docker':
        if (!data.dockerConfig || !data.dockerConfig.image) {
          throw new MCPConnectionError('Docker transport requires image');
        }
        break;
        
      case 'http':
        if (!data.httpConfig || !data.httpConfig.url) {
          throw new MCPConnectionError('HTTP transport requires URL');
        }
        
        try {
          new URL(data.httpConfig.url);
        } catch (error) {
          throw new MCPConnectionError('HTTP transport requires valid URL');
        }
        break;
        
      default:
        throw new MCPConnectionError(
          `Unsupported transport type: ${data.transport}`
        );
    }
  }

  /**
   * 안전한 JSON 파싱
   */
  private safeJsonParse<T>(jsonString: string | null, defaultValue: T): T {
    if (!jsonString) {
      return defaultValue;
    }

    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      this.logger.warn('Failed to parse JSON, using default value', {
        jsonString,
        error: error instanceof Error ? error.message : String(error)
      });
      return defaultValue;
    }
  }

  /**
   * 캐시 무효화
   */
  private async invalidateCache(): Promise<void> {
    try {
      const pattern = `${this.cachePrefix}:*`;
      await this.cache.deleteByPattern(pattern);
      this.logger.debug('Cache invalidated', { pattern });
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 특정 서버 캐시 무효화
   */
  private async invalidateServerCache(serverId: string): Promise<void> {
    try {
      const patterns = [
        `${this.cachePrefix}:${serverId}`,
        `${this.cachePrefix}:list:*`
      ];

      for (const pattern of patterns) {
        await this.cache.deleteByPattern(pattern);
      }

      this.logger.debug('Server cache invalidated', { serverId });
    } catch (error) {
      this.logger.warn('Failed to invalidate server cache', {
        serverId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
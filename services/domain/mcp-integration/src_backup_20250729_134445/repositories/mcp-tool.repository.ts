/**
 * MCP Tool Repository - MCP Integration Service
 * 도구 카탈로그 관리 및 메타데이터 저장
 */

import { BaseRepository, QueryOptions, PaginatedResult } from './base.repository';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';
import { db, McpTool } from '../utils/database';
import { MCPToolResponse } from '../types';

export class MCPToolRepository extends BaseRepository<McpTool, string> {
  protected entityName = 'MCPTool';
  protected cachePrefix = 'tools';

  constructor(cache: CacheService, logger: Logger) {
    super(cache, logger);
  }

  /**
   * 서버의 도구 목록 조회 (계약 준수: GET /mcp/servers/{id}/tools)
   */
  async findToolsByServerId(serverId: string): Promise<MCPToolResponse[]> {
    try {
      const cacheKey = `tools:server:${serverId}`;
      const cached = await this.cache.get<MCPToolResponse[]>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for server tools', { serverId });
        return cached;
      }

      const tools = await this.findWhereFromDatabase({ serverId });
      const result = tools.map(this.toResponseFormat);

      // 캐시 저장 (15분)
      await this.cache.set(cacheKey, result, 900);

      this.logger.info('Tools retrieved for server', { 
        serverId, 
        count: tools.length 
      });

      return result;
    } catch (error) {
      this.handleError('findToolsByServerId', error, { serverId });
    }
  }

  /**
   * 도구 등록/업데이트 (디스커버리 시 사용)
   */
  async upsertTool(toolData: {
    serverId: string;
    name: string;
    description?: string;
    version?: string;
    schema?: any;
    capabilities?: string[];
  }): Promise<MCPToolResponse> {
    try {
      // 기존 도구 확인
      const existing = await this.findByServerAndName(toolData.serverId, toolData.name);

      let tool: McpTool;

      if (existing) {
        // 업데이트
        tool = await this.updateInDatabase(existing.id, {
          description: toolData.description,
          version: toolData.version,
          schema: toolData.schema,
          capabilities: toolData.capabilities || [],
          updatedAt: new Date()
        });

        this.logger.info('Tool updated', { 
          toolId: tool.id,
          serverId: toolData.serverId,
          name: toolData.name 
        });
      } else {
        // 새로 생성
        tool = await this.createInDatabase({
          serverId: toolData.serverId,
          name: toolData.name,
          description: toolData.description,
          version: toolData.version,
          schema: toolData.schema,
          capabilities: toolData.capabilities || [],
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        this.logger.info('Tool created', { 
          toolId: tool.id,
          serverId: toolData.serverId,
          name: toolData.name 
        });
      }

      // 서버 도구 캐시 무효화
      await this.cache.del(`tools:server:${toolData.serverId}`);
      await this.invalidateRelatedCache();

      return this.toResponseFormat(tool);
    } catch (error) {
      this.handleError('upsertTool', error, { toolData });
    }
  }

  /**
   * 도구 활성화/비활성화
   */
  async setToolEnabled(toolId: string, enabled: boolean): Promise<void> {
    try {
      const tool = await this.updateInDatabase(toolId, {
        isEnabled: enabled,
        updatedAt: new Date()
      });

      // 서버 도구 캐시 무효화
      await this.cache.del(`tools:server:${tool.serverId}`);

      this.logger.info('Tool enabled status changed', { 
        toolId, 
        enabled,
        serverId: tool.serverId 
      });
    } catch (error) {
      this.handleError('setToolEnabled', error, { toolId, enabled });
    }
  }

  /**
   * 서버의 모든 도구 제거
   */
  async deleteToolsByServerId(serverId: string): Promise<number> {
    try {
      const tools = await this.findWhereFromDatabase({ serverId });
      let deletedCount = 0;

      for (const tool of tools) {
        const success = await this.deleteFromDatabase(tool.id);
        if (success) deletedCount++;
      }

      // 캐시 무효화
      await this.cache.del(`tools:server:${serverId}`);
      await this.invalidateRelatedCache();

      this.logger.info('Tools deleted for server', { 
        serverId, 
        deletedCount 
      });

      return deletedCount;
    } catch (error) {
      this.handleError('deleteToolsByServerId', error, { serverId });
    }
  }

  /**
   * 도구 이름으로 검색
   */
  async searchToolsByName(name: string, limit: number = 20): Promise<MCPToolResponse[]> {
    try {
      const cacheKey = `tools:search:${name}:${limit}`;
      const cached = await this.cache.get<MCPToolResponse[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // 실제 구현은 Prisma 문제 해결 후 LIKE 검색 추가
      const tools = await this.findWhereFromDatabase({}, { limit });
      const filtered = tools.filter(tool => 
        tool.name.toLowerCase().includes(name.toLowerCase())
      );

      const result = filtered.map(this.toResponseFormat);

      // 캐시 저장 (5분)
      await this.cache.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      this.handleError('searchToolsByName', error, { name, limit });
    }
  }

  /**
   * 활성화된 도구만 조회
   */
  async findEnabledToolsByServerId(serverId: string): Promise<MCPToolResponse[]> {
    try {
      const allTools = await this.findToolsByServerId(serverId);
      return allTools.filter(tool => tool.isEnabled);
    } catch (error) {
      this.handleError('findEnabledToolsByServerId', error, { serverId });
    }
  }

  /**
   * 서버와 이름으로 도구 조회
   */
  async findByServerAndName(serverId: string, name: string): Promise<McpTool | null> {
    try {
      const cacheKey = `tools:lookup:${serverId}:${name}`;
      const cached = await this.cache.get<McpTool>(cacheKey);
      if (cached) {
        return cached;
      }

      const tools = await this.findWhereFromDatabase({ serverId, name }, { limit: 1 });
      const tool = tools[0] || null;

      if (tool) {
        await this.cache.set(cacheKey, tool, 600); // 10분
      }

      return tool;
    } catch (error) {
      this.handleError('findByServerAndName', error, { serverId, name });
    }
  }

  /**
   * 도구 통계 조회
   */
  async getToolStats(): Promise<{
    totalTools: number;
    enabledTools: number;
    toolsByServer: Record<string, number>;
  }> {
    try {
      const cacheKey = 'tools:stats';
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const allTools = await this.findWhereFromDatabase({});
      
      const stats = {
        totalTools: allTools.length,
        enabledTools: allTools.filter(t => t.isEnabled).length,
        toolsByServer: allTools.reduce((acc, tool) => {
          acc[tool.serverId] = (acc[tool.serverId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      // 캐시 저장 (5분)
      await this.cache.set(cacheKey, stats, 300);

      return stats;
    } catch (error) {
      this.handleError('getToolStats', error);
    }
  }

  // BaseRepository 구현
  protected async findByIdFromDatabase(id: string): Promise<McpTool | null> {
    return await db.findManyMcpTools({ where: { id } }).then(tools => tools[0] || null);
  }

  protected async createInDatabase(data: Partial<McpTool>): Promise<McpTool> {
    return await db.createMcpTool(data);
  }

  protected async updateInDatabase(id: string, data: Partial<McpTool>): Promise<McpTool> {
    // 실제 구현은 Prisma 문제 해결 후
    this.logger.info('updateInDatabase called', { id, data });
    return {} as McpTool;
  }

  protected async deleteFromDatabase(id: string): Promise<boolean> {
    try {
      // 실제 구현은 Prisma 문제 해결 후
      this.logger.info('deleteFromDatabase called', { id });
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async findManyFromDatabase(options: QueryOptions): Promise<PaginatedResult<McpTool>> {
    const items = await db.findManyMcpTools({
      skip: options.offset,
      take: options.limit,
      orderBy: options.orderBy
    });

    const total = await this.countFromDatabase();

    return {
      items,
      total,
      limit: options.limit || 20,
      offset: options.offset || 0,
      hasMore: (options.offset || 0) + items.length < total
    };
  }

  protected async findWhereFromDatabase(
    conditions: Partial<McpTool>, 
    options: QueryOptions = {}
  ): Promise<McpTool[]> {
    return await db.findManyMcpTools({
      where: conditions,
      skip: options.offset,
      take: options.limit,
      orderBy: options.orderBy
    });
  }

  protected async countFromDatabase(conditions?: Partial<McpTool>): Promise<number> {
    // 실제 구현은 Prisma 문제 해결 후
    return 0;
  }

  protected getEntityId(entity: McpTool): string {
    return entity.id;
  }

  // Helper methods
  private toResponseFormat(tool: McpTool): MCPToolResponse {
    return {
      id: tool.id,
      serverId: tool.serverId,
      name: tool.name,
      description: tool.description,
      version: tool.version,
      schema: tool.schema,
      capabilities: Array.isArray(tool.capabilities) ? tool.capabilities : [],
      isEnabled: tool.isEnabled,
      createdAt: tool.createdAt.toISOString(),
      updatedAt: tool.updatedAt.toISOString()
    };
  }
}
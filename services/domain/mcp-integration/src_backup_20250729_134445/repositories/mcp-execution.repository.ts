/**
 * MCP Execution Repository - MCP Integration Service
 * 실행 이력 및 상태 관리
 */

import { BaseRepository, QueryOptions, PaginatedResult } from './base.repository';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';
import { db, McpExecution } from '../utils/database';
import { MCPExecutionStatus } from '../types';

export class MCPExecutionRepository extends BaseRepository<McpExecution, string> {
  protected entityName = 'MCPExecution';
  protected cachePrefix = 'execution';

  constructor(cache: CacheService, logger: Logger) {
    super(cache, logger);
  }

  /**
   * 실행 생성 (계약 준수: POST /mcp/execute)
   */
  async createExecution(data: {
    serverId: string;
    toolName: string;
    executionParams: Record<string, any>;
    executedBy?: string;
  }): Promise<McpExecution> {
    try {
      const execution = await this.createInDatabase({
        serverId: data.serverId,
        toolName: data.toolName,
        executionParams: data.executionParams,
        status: 'pending',
        executedBy: data.executedBy,
        startedAt: new Date()
      });

      this.logger.info('Execution created', {
        executionId: execution.id,
        serverId: data.serverId,
        toolName: data.toolName
      });

      return execution;
    } catch (error) {
      this.handleError('createExecution', error, { data });
    }
  }

  /**
   * 실행 상태 조회 (계약 준수: GET /mcp/executions/{id})
   */
  async getExecutionStatus(executionId: string): Promise<MCPExecutionStatus | null> {
    try {
      const execution = await this.findById(executionId);
      
      if (!execution) {
        return null;
      }

      return this.toStatusFormat(execution);
    } catch (error) {
      this.handleError('getExecutionStatus', error, { executionId });
    }
  }

  /**
   * 실행 상태 업데이트
   */
  async updateExecutionStatus(
    executionId: string, 
    status: 'running' | 'completed' | 'failed' | 'cancelled',
    data?: {
      result?: any;
      errorMessage?: string;
      completedAt?: Date;
      durationMs?: number;
    }
  ): Promise<McpExecution> {
    try {
      const updateData: Partial<McpExecution> = {
        status
      };

      if (data?.result !== undefined) {
        updateData.result = data.result;
      }

      if (data?.errorMessage) {
        updateData.errorMessage = data.errorMessage;
      }

      if (data?.completedAt) {
        updateData.completedAt = data.completedAt;
      }

      if (data?.durationMs !== undefined) {
        updateData.durationMs = data.durationMs;
      }

      // 완료 상태인 경우 completedAt 자동 설정
      if (['completed', 'failed', 'cancelled'].includes(status) && !data?.completedAt) {
        updateData.completedAt = new Date();
      }

      const execution = await this.updateInDatabase(executionId, updateData);

      // 실행 상태 캐시 업데이트
      await this.cache.set(`execution:status:${executionId}`, status, 300);

      this.logger.info('Execution status updated', {
        executionId,
        status,
        hasResult: !!data?.result,
        hasError: !!data?.errorMessage
      });

      return execution;
    } catch (error) {
      this.handleError('updateExecutionStatus', error, { executionId, status, data });
    }
  }

  /**
   * 서버별 실행 이력 조회
   */
  async findExecutionsByServerId(
    serverId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<McpExecution[]> {
    try {
      const cacheKey = this.getServerExecutionsCacheKey(serverId, options);
      const cached = await this.cache.get<McpExecution[]>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for server executions', { serverId });
        return cached;
      }

      const where: any = { serverId };
      
      if (options.status) {
        where.status = options.status;
      }

      // 날짜 범위 필터링 (실제 구현은 Prisma 문제 해결 후)
      if (options.startDate || options.endDate) {
        where.startedAt = {};
        if (options.startDate) {
          where.startedAt.gte = options.startDate;
        }
        if (options.endDate) {
          where.startedAt.lte = options.endDate;
        }
      }

      const executions = await this.findWhereFromDatabase(where, {
        limit: options.limit || 50,
        offset: options.offset || 0,
        orderBy: { startedAt: 'desc' }
      });

      // 캐시 저장 (2분)
      await this.cache.set(cacheKey, executions, 120);

      this.logger.info('Executions retrieved for server', {
        serverId,
        count: executions.length,
        options
      });

      return executions;
    } catch (error) {
      this.handleError('findExecutionsByServerId', error, { serverId, options });
    }
  }

  /**
   * 진행 중인 실행 조회
   */
  async findRunningExecutions(): Promise<McpExecution[]> {
    try {
      const cacheKey = 'execution:running';
      const cached = await this.cache.get<McpExecution[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const executions = await this.findWhereFromDatabase({ 
        status: 'running' 
      });

      // 캐시 저장 (30초)
      await this.cache.set(cacheKey, executions, 30);

      return executions;
    } catch (error) {
      this.handleError('findRunningExecutions', error);
    }
  }

  /**
   * 오래된 실행 정리 (5분 이상 running 상태)
   */
  async cleanupStaleExecutions(): Promise<number> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const staleExecutions = await this.findWhereFromDatabase({
        status: 'running'
        // startedAt: { lt: fiveMinutesAgo } // 실제 구현 시 추가
      });

      let cleanedCount = 0;

      for (const execution of staleExecutions) {
        if (execution.startedAt < fiveMinutesAgo) {
          await this.updateExecutionStatus(
            execution.id,
            'failed',
            {
              errorMessage: 'Execution timed out',
              completedAt: new Date(),
              durationMs: Date.now() - execution.startedAt.getTime()
            }
          );
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.info('Stale executions cleaned up', { cleanedCount });
        
        // 캐시 무효화
        await this.cache.del('execution:running');
      }

      return cleanedCount;
    } catch (error) {
      this.handleError('cleanupStaleExecutions', error);
    }
  }

  /**
   * 실행 통계 조회
   */
  async getExecutionStats(serverId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    avgDuration: number;
    successRate: number;
  }> {
    try {
      const cacheKey = `execution:stats:${serverId || 'all'}`;
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const where = serverId ? { serverId } : {};
      const executions = await this.findWhereFromDatabase(where);
      
      const stats = {
        total: executions.length,
        byStatus: executions.reduce((acc, exec) => {
          acc[exec.status] = (acc[exec.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        avgDuration: this.calculateAverageDuration(executions),
        successRate: this.calculateSuccessRate(executions)
      };

      // 캐시 저장 (5분)
      await this.cache.set(cacheKey, stats, 300);

      return stats;
    } catch (error) {
      this.handleError('getExecutionStats', error, { serverId });
    }
  }

  // BaseRepository 구현
  protected async findByIdFromDatabase(id: string): Promise<McpExecution | null> {
    return await db.findManyMcpExecutions({ where: { id } }).then(execs => execs[0] || null);
  }

  protected async createInDatabase(data: Partial<McpExecution>): Promise<McpExecution> {
    return await db.createMcpExecution(data);
  }

  protected async updateInDatabase(id: string, data: Partial<McpExecution>): Promise<McpExecution> {
    return await db.updateMcpExecution({ id }, data);
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

  protected async findManyFromDatabase(options: QueryOptions): Promise<PaginatedResult<McpExecution>> {
    const items = await db.findManyMcpExecutions({
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
    conditions: Partial<McpExecution>, 
    options: QueryOptions = {}
  ): Promise<McpExecution[]> {
    return await db.findManyMcpExecutions({
      where: conditions,
      skip: options.offset,
      take: options.limit,
      orderBy: options.orderBy
    });
  }

  protected async countFromDatabase(conditions?: Partial<McpExecution>): Promise<number> {
    // 실제 구현은 Prisma 문제 해결 후
    return 0;
  }

  protected getEntityId(entity: McpExecution): string {
    return entity.id;
  }

  // Helper methods
  private toStatusFormat(execution: McpExecution): MCPExecutionStatus {
    return {
      executionId: execution.id,
      status: execution.status as any,
      startedAt: execution.startedAt.toISOString(),
      completedAt: execution.completedAt?.toISOString(),
      result: execution.result,
      error: execution.errorMessage
    };
  }

  private getServerExecutionsCacheKey(serverId: string, options: any): string {
    const optionsStr = JSON.stringify(options);
    const hash = Buffer.from(optionsStr).toString('base64').slice(0, 12);
    return `execution:server:${serverId}:${hash}`;
  }

  private calculateAverageDuration(executions: McpExecution[]): number {
    const completedExecutions = executions.filter(e => e.durationMs);
    if (completedExecutions.length === 0) return 0;

    const totalDuration = completedExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0);
    return Math.round(totalDuration / completedExecutions.length);
  }

  private calculateSuccessRate(executions: McpExecution[]): number {
    if (executions.length === 0) return 0;

    const completedExecutions = executions.filter(e => 
      ['completed', 'failed'].includes(e.status)
    );
    
    if (completedExecutions.length === 0) return 0;

    const successfulExecutions = completedExecutions.filter(e => 
      e.status === 'completed'
    );

    return Math.round((successfulExecutions.length / completedExecutions.length) * 100);
  }
}
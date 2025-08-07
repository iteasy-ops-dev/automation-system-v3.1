/**
 * MCP Execution Repository
 * 실행 이력 관리
 */

import { McpExecution, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { MCPExecutionResponse, MCPExecutionFilter } from '../types';

export interface MCPExecutionCreate {
  serverId: string;
  toolName: string;
  executionParams?: Record<string, any>;
  executedBy?: string;
}

export class MCPExecutionRepository {
  /**
   * Prisma 모델을 도메인 모델로 변환
   */
  private toDomainModel(dbModel: McpExecution): MCPExecutionResponse {
    return {
      executionId: dbModel.id,
      serverId: dbModel.serverId,
      method: dbModel.toolName,
      status: dbModel.status as any,
      result: dbModel.result,
      error: dbModel.errorMessage || undefined,
      startedAt: dbModel.startedAt?.toISOString() || new Date().toISOString(),
      completedAt: dbModel.completedAt?.toISOString(),
      duration: dbModel.durationMs || undefined
    };
  }

  /**
   * 실행 생성
   */
  async createExecution(data: MCPExecutionCreate): Promise<string> {
    const execution = await prisma.mcpExecution.create({
      data: {
        serverId: data.serverId,
        toolName: data.toolName,
        executionParams: data.executionParams || {},
        status: 'pending',
        executedBy: data.executedBy
      }
    });

    return execution.id;
  }

  /**
   * 실행 시작 기록
   */
  async markStarted(executionId: string): Promise<void> {
    await prisma.mcpExecution.update({
      where: { id: executionId },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    });
  }

  /**
   * 실행 완료 기록
   */
  async markCompleted(
    executionId: string,
    result: any
  ): Promise<void> {
    const execution = await prisma.mcpExecution.findUnique({
      where: { id: executionId }
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const startedAt = execution.startedAt || new Date();
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.mcpExecution.update({
      where: { id: executionId },
      data: {
        status: 'completed',
        result: result,
        completedAt,
        durationMs
      }
    });
  }

  /**
   * 실행 실패 기록
   */
  async markFailed(
    executionId: string,
    error: string
  ): Promise<void> {
    const execution = await prisma.mcpExecution.findUnique({
      where: { id: executionId }
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const startedAt = execution.startedAt || new Date();
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.mcpExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        errorMessage: error,
        completedAt,
        durationMs
      }
    });
  }

  /**
   * ID로 실행 조회
   */
  async findById(executionId: string): Promise<MCPExecutionResponse | null> {
    const execution = await prisma.mcpExecution.findUnique({
      where: { id: executionId }
    });

    return execution ? this.toDomainModel(execution) : null;
  }

  /**
   * 실행 목록 조회
   */
  async findMany(
    filter?: MCPExecutionFilter,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: MCPExecutionResponse[]; total: number }> {
    const where: Prisma.McpExecutionWhereInput = {};

    if (filter) {
      if (filter.serverId) {
        where.serverId = filter.serverId;
      }
      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.startDate || filter.endDate) {
        where.startedAt = {};
        if (filter.startDate) {
          where.startedAt.gte = filter.startDate;
        }
        if (filter.endDate) {
          where.startedAt.lte = filter.endDate;
        }
      }
    }

    const [items, total] = await Promise.all([
      prisma.mcpExecution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { startedAt: 'desc' }
      }),
      prisma.mcpExecution.count({ where })
    ]);

    return {
      items: items.map(item => this.toDomainModel(item)),
      total
    };
  }

  /**
   * 오래된 실행 이력 정리
   */
  async cleanupOldExecutions(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.mcpExecution.deleteMany({
      where: {
        completedAt: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }
}

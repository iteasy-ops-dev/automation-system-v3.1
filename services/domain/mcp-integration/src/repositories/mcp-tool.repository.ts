/**
 * MCP Tool Repository
 * 도구 메타데이터 관리
 */

import { McpTool, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { MCPTool, MCPToolResponse } from '../types';

export interface MCPToolCreate {
  serverId: string;
  name: string;
  description?: string;
  inputSchema?: any;
  version?: string;
}

export class MCPToolRepository {
  /**
   * Prisma 모델을 도메인 모델로 변환
   */
  private toDomainModel(dbModel: McpTool): MCPToolResponse {
    return {
      serverId: dbModel.serverId,
      name: dbModel.name,
      description: dbModel.description || undefined,
      inputSchema: dbModel.schema || undefined,
      version: dbModel.version || undefined
    };
  }

  /**
   * 도구 생성 또는 업데이트
   */
  async upsert(data: MCPToolCreate): Promise<MCPToolResponse> {
    const upserted = await prisma.mcpTool.upsert({
      where: {
        unique_tool_per_server: {
          serverId: data.serverId,
          name: data.name
        }
      },
      update: {
        description: data.description,
        schema: data.inputSchema,
        version: data.version,
        capabilities: [],
        isEnabled: true
      },
      create: {
        serverId: data.serverId,
        name: data.name,
        description: data.description,
        schema: data.inputSchema,
        version: data.version,
        capabilities: [],
        isEnabled: true
      }
    });

    return this.toDomainModel(upserted);
  }

  /**
   * 서버의 모든 도구 조회
   */
  async findByServerId(serverId: string): Promise<MCPToolResponse[]> {
    const tools = await prisma.mcpTool.findMany({
      where: { 
        serverId,
        isEnabled: true
      },
      orderBy: { name: 'asc' }
    });

    return tools.map(tool => this.toDomainModel(tool));
  }

  /**
   * 특정 도구 조회
   */
  async findByServerAndName(serverId: string, name: string): Promise<MCPToolResponse | null> {
    const tool = await prisma.mcpTool.findUnique({
      where: {
        unique_tool_per_server: {
          serverId,
          name
        }
      }
    });

    return tool ? this.toDomainModel(tool) : null;
  }

  /**
   * 서버의 모든 도구 삭제
   */
  async deleteToolsByServerId(serverId: string): Promise<void> {
    await prisma.mcpTool.deleteMany({
      where: { serverId }
    });
  }

  /**
   * 서버의 도구 목록 동기화
   * 기존 도구 중 목록에 없는 것은 비활성화
   */
  async syncTools(serverId: string, tools: MCPTool[]): Promise<void> {
    // 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      // 모든 도구를 비활성화
      await tx.mcpTool.updateMany({
        where: { serverId },
        data: { isEnabled: false }
      });

      // 새로운 도구들을 upsert
      for (const tool of tools) {
        await tx.mcpTool.upsert({
          where: {
            unique_tool_per_server: {
              serverId,
              name: tool.name
            }
          },
          update: {
            description: tool.description,
            schema: tool.inputSchema,
            isEnabled: true
          },
          create: {
            serverId,
            name: tool.name,
            description: tool.description,
            schema: tool.inputSchema,
            capabilities: [],
            isEnabled: true
          }
        });
      }
    });
  }
}

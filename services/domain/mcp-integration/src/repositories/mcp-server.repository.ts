/**
 * MCP Server Repository
 * Prisma를 사용한 데이터 액세스 레이어
 */

import { McpServer, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  MCPServer,
  MCPServerCreate,
  MCPServerUpdate,
  MCPServerFilter,
  MCPTransportType,
  MCPServerStatus,
  MCPConnectionStatus,
  MCPServerInfo
} from '../types';

export class MCPServerRepository {
  /**
   * Prisma 모델을 도메인 모델로 변환
   */
  private toDomainModel(dbModel: McpServer): MCPServer {
    return {
      id: dbModel.id,
      name: dbModel.name,
      description: dbModel.description || undefined,
      transport: dbModel.transport as MCPTransportType,
      status: (dbModel.status || 'inactive') as MCPServerStatus,
      connectionStatus: (dbModel.connectionStatus || 'disconnected') as MCPConnectionStatus,
      command: dbModel.command || undefined,
      args: dbModel.args || undefined,
      sshConfig: dbModel.sshConfig as any || undefined,
      dockerConfig: dbModel.dockerConfig as any || undefined,
      httpConfig: dbModel.httpConfig as any || undefined,
      serverInfo: dbModel.serverInfo as unknown as MCPServerInfo || undefined,
      capabilities: dbModel.capabilities as any[] || undefined,
      lastHeartbeat: dbModel.lastHeartbeat?.toISOString() || undefined,
      lastError: dbModel.lastError || undefined,
      metadata: dbModel.metadata as Record<string, any> || undefined,
      createdAt: dbModel.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: dbModel.updatedAt?.toISOString() || new Date().toISOString()
    };
  }

  /**
   * 서버 생성
   */
  async create(data: MCPServerCreate): Promise<MCPServer> {
    const createData: Prisma.McpServerCreateInput = {
      name: data.name,
      description: data.description,
      serverType: data.serverType || 'generic', // 기본값 설정
      endpointUrl: data.endpointUrl || `${data.transport}://${data.name}`, // 기본값 생성
      transport: data.transport,
      status: 'inactive',
      connectionStatus: 'disconnected',
      command: data.command,
      args: data.args,
      sshConfig: data.sshConfig ? data.sshConfig : undefined,
      dockerConfig: data.dockerConfig ? data.dockerConfig : undefined,
      httpConfig: data.httpConfig ? data.httpConfig : undefined,
      metadata: data.metadata
    };

    const created = await prisma.mcpServer.create({
      data: createData
    });

    return this.toDomainModel(created);
  }

  /**
   * ID로 서버 조회
   */
  async findById(id: string): Promise<MCPServer | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { id }
    });

    return server ? this.toDomainModel(server) : null;
  }

  /**
   * 이름으로 서버 조회
   */
  async findByName(name: string): Promise<MCPServer | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { name }
    });

    return server ? this.toDomainModel(server) : null;
  }

  /**
   * 서버 목록 조회
   */
  async findMany(
    filter?: MCPServerFilter,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: MCPServer[]; total: number }> {
    const where: Prisma.McpServerWhereInput = {};

    if (filter) {
      if (filter.transport) {
        where.transport = filter.transport;
      }
      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.connectionStatus) {
        where.connectionStatus = filter.connectionStatus;
      }
      if (filter.search) {
        where.OR = [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } }
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.mcpServer.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.mcpServer.count({ where })
    ]);

    return {
      items: items.map(item => this.toDomainModel(item)),
      total
    };
  }

  /**
   * 서버 수정
   */
  async update(id: string, data: MCPServerUpdate): Promise<MCPServer | null> {
    const updateData: Prisma.McpServerUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.command !== undefined) updateData.command = data.command;
    if (data.args !== undefined) updateData.args = data.args;
    if (data.sshConfig !== undefined) updateData.sshConfig = data.sshConfig;
    if (data.dockerConfig !== undefined) updateData.dockerConfig = data.dockerConfig;
    if (data.httpConfig !== undefined) updateData.httpConfig = data.httpConfig;

    const updated = await prisma.mcpServer.update({
      where: { id },
      data: updateData
    });

    return this.toDomainModel(updated);
  }

  /**
   * 서버 삭제
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.mcpServer.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 연결 상태 업데이트
   */
  async updateConnectionStatus(
    id: string,
    connectionStatus: MCPConnectionStatus,
    serverInfo?: any,
    lastError?: string
  ): Promise<void> {
    const updateData: Prisma.McpServerUpdateInput = {
      connectionStatus,
      lastHeartbeat: new Date()
    };

    if (serverInfo) {
      updateData.serverInfo = serverInfo;
    }

    if (lastError !== undefined) {
      updateData.lastError = lastError;
    }

    await prisma.mcpServer.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * 모든 서버의 연결 상태 초기화 (서비스 시작 시)
   */
  async resetAllConnectionStatus(): Promise<void> {
    await prisma.mcpServer.updateMany({
      data: {
        connectionStatus: 'disconnected'
      }
    });
  }

  /**
   * 서버 삭제
   */
  async deleteServer(id: string): Promise<void> {
    await prisma.mcpServer.delete({
      where: { id }
    });
  }
}

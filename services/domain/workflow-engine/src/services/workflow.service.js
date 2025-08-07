const { v4: uuidv4 } = require('uuid');
const prismaService = require('./prisma.service');
const redisService = require('./redis.service');
const kafkaService = require('./kafka.service');
const logger = require('../utils/logger');

class WorkflowService {
  constructor() {
    this.prisma = prismaService;
  }

  // 워크플로우 생성 (TASK-2 계약 준수)
  async createWorkflow(data) {
    try {
      const workflow = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflow.create({
            data: {
              id: uuidv4(),
              name: data.name,
              description: data.description,
              definition: data.definition,
              version: data.version || 1,
              status: data.status || 'active',
              tags: data.tags || [],
              createdBy: data.createdBy
            }
          });
        },
        '워크플로우 생성 실패'
      );

      // 캐시에 정의 저장
      await redisService.setWorkflowDefinition(workflow.id, workflow.definition);

      logger.info(`✅ 워크플로우 생성 완료: ${workflow.id} (${workflow.name})`);
      return workflow;
    } catch (error) {
      logger.error('❌ 워크플로우 생성 실패:', error);
      throw error;
    }
  }

  // 워크플로우 조회
  async getWorkflow(workflowId) {
    try {
      // n8n 워크플로우인 경우 DB 조회 스킵
      if (!this.isValidUUID(workflowId)) {
        logger.info(`📝 n8n 외부 워크플로우 조회 스킵: ${workflowId}`);
        return { id: workflowId, definition: null, external: true };
      }

      // 캐시에서 먼저 확인
      let definition = await redisService.getWorkflowDefinition(workflowId);
      
      if (!definition) {
        const workflow = await this.prisma.executeQuery(
          async (prisma) => {
            return await prisma.workflow.findUnique({
              where: { id: workflowId }
            });
          },
          '워크플로우 조회 실패'
        );

        if (!workflow) {
          throw new Error(`워크플로우를 찾을 수 없습니다: ${workflowId}`);
        }

        // 캐시에 저장
        await redisService.setWorkflowDefinition(workflowId, workflow.definition);
        return workflow;
      }

      return { id: workflowId, definition };
    } catch (error) {
      logger.error(`❌ 워크플로우 조회 실패: ${workflowId}`, error);
      throw error;
    }
  }

  // 워크플로우 목록 조회
  async getWorkflows(filters = {}) {
    try {
      const where = {};
      
      if (filters.status) where.status = filters.status;
      if (filters.createdBy) where.createdBy = filters.createdBy;
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const workflows = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflow.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters.limit || 20,
            skip: filters.offset || 0
          });
        },
        '워크플로우 목록 조회 실패'
      );

      return workflows;
    } catch (error) {
      logger.error('❌ 워크플로우 목록 조회 실패:', error);
      throw error;
    }
  }

  // 워크플로우 실행 시작
  async startExecution(workflowId, sessionId = null, inputData = {}, executedBy = null) {
    try {
      const executionId = uuidv4();

      // 워크플로우 존재 확인 (외부 n8n 워크플로우는 스킵)
      if (this.isValidUUID(workflowId)) {
        const workflow = await this.getWorkflow(workflowId);
        if (!workflow) {
          throw new Error(`워크플로우를 찾을 수 없습니다: ${workflowId}`);
        }
      } else {
        logger.info(`📝 n8n 외부 워크플로우 사용: ${workflowId}`);
      }

      // 실행 기록 생성
      const execution = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.create({
            data: {
              id: executionId,
              workflowId,
              sessionId,
              status: 'pending',
              inputData,
              executedBy,
              startedAt: new Date()
            }
          });
        },
        '워크플로우 실행 시작 실패'
      );

      // Redis에 실행 상태 저장
      await redisService.setExecutionStatus(executionId, 'pending');

      // Kafka 이벤트 발행
      await kafkaService.publishWorkflowStarted(
        workflowId,
        executionId,
        sessionId,
        inputData
      );

      logger.info(`✅ 워크플로우 실행 시작: ${executionId} (워크플로우: ${workflowId})`);
      return execution;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 시작 실패: ${workflowId}`, error);
      throw error;
    }
  }

  // 워크플로우 실행 상태 업데이트
  async updateExecutionStatus(executionId, status, outputData = null, errorDetails = null) {
    try {
      const completedAt = (status === 'completed' || status === 'failed') ? new Date() : null;
      
      const execution = await this.prisma.executeQuery(
        async (prisma) => {
          const existing = await prisma.workflowExecution.findUnique({
            where: { id: executionId }
          });

          if (!existing) {
            throw new Error(`실행을 찾을 수 없습니다: ${executionId}`);
          }

          const durationMs = completedAt ? 
            new Date(completedAt).getTime() - new Date(existing.startedAt).getTime() : null;

          return await prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
              status,
              outputData,
              errorDetails,
              completedAt,
              durationMs
            }
          });
        },
        '워크플로우 실행 상태 업데이트 실패'
      );

      // Redis 상태 업데이트
      await redisService.setExecutionStatus(executionId, status, 100);

      // Kafka 이벤트 발행
      if (status === 'completed') {
        await kafkaService.publishWorkflowCompleted(
          execution.workflowId,
          executionId,
          outputData,
          execution.durationMs
        );
      } else if (status === 'failed') {
        await kafkaService.publishWorkflowFailed(
          execution.workflowId,
          executionId,
          errorDetails,
          execution.durationMs
        );
      }

      logger.info(`✅ 워크플로우 실행 상태 업데이트: ${executionId} -> ${status}`);
      return execution;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 상태 업데이트 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 워크플로우 실행 조회
  async getExecution(executionId) {
    try {
      // Redis에서 실시간 상태 확인
      const cachedStatus = await redisService.getExecutionStatus(executionId);

      const execution = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.findUnique({
            where: { id: executionId },
            include: {
              steps: {
                orderBy: { startedAt: 'asc' }
              }
            }
          });
        },
        '워크플로우 실행 조회 실패'
      );

      if (!execution) {
        throw new Error(`실행을 찾을 수 없습니다: ${executionId}`);
      }

      // 캐시된 상태가 있다면 병합
      if (cachedStatus) {
        execution.realTimeStatus = cachedStatus;
      }

      return execution;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 조회 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 워크플로우 실행 단계 추가
  async addExecutionStep(executionId, stepId, stepName, stepType, inputData = null) {
    try {
      const step = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecutionStep.create({
            data: {
              executionId,
              stepId,
              stepName,
              stepType,
              status: 'pending',
              inputData
            }
          });
        },
        '워크플로우 실행 단계 추가 실패'
      );

      // Redis 상태 업데이트 (현재 단계 표시)
      await redisService.setExecutionStatus(executionId, 'running', null, stepName);

      // Kafka 이벤트 발행
      await kafkaService.publishWorkflowStepStarted(
        step.executionId,
        executionId,
        stepId,
        stepName
      );

      logger.debug(`워크플로우 단계 추가: ${executionId} -> ${stepName}`);
      return step;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 단계 추가 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 워크플로우 실행 단계 완료
  async completeExecutionStep(executionId, stepId, status, outputData = null, errorDetails = null) {
    try {
      const step = await this.prisma.executeQuery(
        async (prisma) => {
          const existing = await prisma.workflowExecutionStep.findFirst({
            where: { executionId, stepId }
          });

          if (!existing) {
            throw new Error(`단계를 찾을 수 없습니다: ${stepId}`);
          }

          const completedAt = new Date();
          const durationMs = existing.startedAt ? 
            completedAt.getTime() - new Date(existing.startedAt).getTime() : null;

          return await prisma.workflowExecutionStep.update({
            where: { id: existing.id },
            data: {
              status,
              outputData,
              errorDetails,
              completedAt,
              durationMs
            }
          });
        },
        '워크플로우 실행 단계 완료 실패'
      );

      // Kafka 이벤트 발행
      await kafkaService.publishWorkflowStepCompleted(
        step.executionId,
        executionId,
        stepId,
        step.stepName,
        status,
        step.durationMs
      );

      logger.debug(`워크플로우 단계 완료: ${executionId} -> ${step.stepName} (${status})`);
      return step;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 단계 완료 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 워크플로우 실행 목록 조회
  async getExecutions(workflowId, limit = 10) {
    try {
      const executions = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.findMany({
            where: { workflowId },
            orderBy: { startedAt: 'desc' },
            take: limit,
            include: {
              steps: {
                orderBy: { startedAt: 'asc' }
              }
            }
          });
        },
        '워크플로우 실행 목록 조회 실패'
      );

      return executions;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 목록 조회 실패: ${workflowId}`, error);
      throw error;
    }
  }

  // 사용자별 실행 목록 조회
  async getUserExecutions(userId, limit = 20) {
    try {
      const executions = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.create({
            where: { executedBy: userId },
            orderBy: { startedAt: 'desc' },
            take: limit,
            select: {
              id: true,
              workflowId: true,
              status: true,
              startedAt: true,
              completedAt: true,
              durationMs: true
            }
          });
        },
        '사용자 실행 목록 조회 실패'
      );

      return executions;
    } catch (error) {
      logger.error(`❌ 사용자 실행 목록 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  // 실행 기록 저장 (n8n 워크플로우용)
  async saveExecution(executionData) {
    try {
      // workflow_id를 강제로 문자열로 변환
      const sanitizedData = {
        ...executionData,
        workflow_id: String(executionData.workflow_id || executionData.workflowId),
        id: executionData.id || uuidv4(),
        started_at: executionData.started_at || new Date(),
        status: executionData.status || 'running'
      };

      // workflow_id가 n8n ID인지 UUID인지 확인
      const isN8nId = !this.isValidUUID(sanitizedData.workflow_id);
      
      if (isN8nId) {
        logger.info(`📝 n8n 워크플로우 ID 사용: ${sanitizedData.workflow_id}`);
      }

      const execution = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.create({
            data: {
              id: sanitizedData.id,
              workflowId: sanitizedData.workflow_id,
              sessionId: sanitizedData.session_id,
              status: sanitizedData.status,
              inputData: sanitizedData.intent_data ? JSON.parse(sanitizedData.intent_data) : sanitizedData.inputData || {},
              outputData: sanitizedData.response_text ? {
                response: sanitizedData.response_text,
                results: sanitizedData.results_data 
              } : sanitizedData.outputData || null,
              errorDetails: sanitizedData.error_details || null,
              startedAt: sanitizedData.started_at,
              completedAt: sanitizedData.completed_at || null,
              durationMs: sanitizedData.duration_ms || null,
              executedBy: sanitizedData.executed_by || null
            }
          });
        },
        '워크플로우 실행 기록 저장 실패'
      );

      logger.info(`✅ 워크플로우 실행 기록 저장: ${execution.id}`);
      return execution;
      
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 기록 저장 실패:`, error);
      throw error;
    }
  }

  // UUID 검증 헬퍼 메서드
  isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
}

module.exports = new WorkflowService();

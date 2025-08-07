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
      // 캐시에서 먼저 확인
      let definition = await redisService.getWorkflowDefinition(workflowId);
      
      if (!definition) {
        const workflow = await this.prisma.executeQuery(
          async (prisma) => {
            return await prisma.workflow.findUnique({
              where: { id: workflowId },
              include: {
                executions: {
                  take: 10,
                  orderBy: { startedAt: 'desc' }
                }
              }
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
            skip: filters.offset || 0,
            include: {
              _count: {
                select: { executions: true }
              }
            }
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
            },
            include: {
              workflow: true
            }
          });
        },
        '워크플로우 실행 시작 실패'
      );

      // Redis에 실행 상태 저장
      await redisService.setExecutionStatus(executionId, 'pending', 0);

      // 세션 매핑 추가
      if (sessionId) {
        await redisService.addSessionExecution(sessionId, executionId);
      }

      // Kafka 이벤트 발행
      await kafkaService.publishWorkflowStarted(workflowId, executionId, {
        sessionId,
        inputData
      });

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
            },
            include: {
              workflow: true
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
              workflow: true,
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
      if (status === 'completed') {
        await kafkaService.publishWorkflowStepCompleted(
          step.executionId,
          executionId,
          stepId,
          step.stepName,
          outputData,
          step.durationMs
        );
      } else if (status === 'failed') {
        await kafkaService.publishWorkflowStepFailed(
          step.executionId,
          executionId,
          stepId,
          step.stepName,
          errorDetails
        );
      }

      logger.debug(`워크플로우 단계 완료: ${executionId}/${stepId} -> ${status}`);
      return step;
    } catch (error) {
      logger.error(`❌ 워크플로우 실행 단계 완료 실패: ${executionId}/${stepId}`, error);
      throw error;
    }
  }

  // 실행 중인 워크플로우 목록
  async getRunningExecutions() {
    try {
      const executions = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.findMany({
            where: {
              status: { in: ['pending', 'running'] }
            },
            include: {
              workflow: {
                select: { name: true }
              }
            },
            orderBy: { startedAt: 'desc' }
          });
        },
        '실행 중인 워크플로우 조회 실패'
      );

      return executions;
    } catch (error) {
      logger.error('❌ 실행 중인 워크플로우 조회 실패:', error);
      throw error;
    }
  }

  // 워크플로우 실행 기록 생성 (TASK-WF-001에서 필요)
  async createExecution(executionData) {
    try {
      const execution = await this.prisma.executeQuery(
        async (prisma) => {
          return await prisma.workflowExecution.create({
            data: {
              id: executionData.executionId,
              workflowId: executionData.workflowId,
              sessionId: executionData.sessionId,
              status: executionData.status,
              startedAt: executionData.startedAt,
              completedAt: executionData.completedAt || null,
              input: executionData.intent ? JSON.stringify(executionData.intent) : '{}',
              output: executionData.response ? JSON.stringify({ response: executionData.response }) : null,
              error: executionData.error || null,
              metadata: executionData.summary ? JSON.stringify(executionData.summary) : '{}'
            }
          });
        },
        '워크플로우 실행 기록 생성 실패'
      );

      logger.info(`✅ 워크플로우 실행 기록 생성: ${execution.id}`);
      return execution;
    } catch (error) {
      logger.error('❌ 워크플로우 실행 기록 생성 실패:', error);
      throw error;
    }
  }

}

module.exports = new WorkflowService();
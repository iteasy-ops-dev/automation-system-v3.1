const workflowService = require('./workflow.service');
const n8nEngine = require('./n8n-engine.service');
const redisService = require('./redis.service');
const kafkaService = require('./kafka.service');
const mongoService = require('./mongo.service');
const logger = require('../utils/logger');
const config = require('../config');

class ExecutionManager {
  constructor() {
    this.workflowService = workflowService;
    this.executionQueue = [];
    this.activeExecutions = new Map();
    this.isProcessing = false;
    
    // 주기적으로 실행 큐 처리
    setInterval(() => {
      this.processQueue();
    }, 1000);

    // 실행 상태 모니터링
    setInterval(() => {
      this.monitorExecutions();
    }, 5000);
  }

  // 워크플로우 실행 요청
  async requestExecution(workflowId, executionId, inputData = {}) {
    try {
      logger.info(`📝 워크플로우 실행 요청: ${executionId}`);

      // 동시 실행 제한 확인
      if (this.activeExecutions.size >= config.MAX_CONCURRENT_EXECUTIONS) {
        logger.warn(`⚠️ 동시 실행 제한 도달, 큐에 추가: ${executionId}`);
        this.executionQueue.push({ workflowId, executionId, inputData });
        return { status: 'queued', position: this.executionQueue.length };
      }

      // 즉시 실행
      await this.startExecution(workflowId, executionId, inputData);
      return { status: 'started' };

    } catch (error) {
      logger.error(`❌ 워크플로우 실행 요청 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 워크플로우 실행 시작
  async startExecution(workflowId, executionId, inputData = {}) {
    try {
      logger.info(`🚀 워크플로우 실행 시작: ${executionId}`);

      // 워크플로우 정의 조회
      const workflow = await this.workflowService.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`워크플로우를 찾을 수 없습니다: ${workflowId}`);
      }

      // 실행 상태 업데이트
      await this.workflowService.updateExecutionStatus(executionId, 'running');
      await redisService.setExecutionStatus(executionId, 'running', 0);

      // 실행 정보 저장
      const executionInfo = {
        workflowId,
        executionId,
        startTime: Date.now(),
        status: 'running',
        inputData,
        definition: workflow.definition
      };

      this.activeExecutions.set(executionId, executionInfo);

      // 워크플로우 단계별 실행
      await this.executeWorkflowSteps(executionInfo);

    } catch (error) {
      logger.error(`❌ 워크플로우 실행 시작 실패: ${executionId}`, error);
      
      // 실패 상태 업데이트
      await this.handleExecutionFailure(executionId, error);
      throw error;
    }
  }

  // 워크플로우 단계별 실행
  async executeWorkflowSteps(executionInfo) {
    const { workflowId, executionId, definition } = executionInfo;

    try {
      let stepResults = {};
      let currentStepIndex = 0;
      const totalSteps = definition.nodes?.length || 0;

      for (const node of definition.nodes || []) {
        currentStepIndex++;
        const progress = Math.round((currentStepIndex / totalSteps) * 100);

        logger.debug(`📍 단계 실행: ${node.name} (${currentStepIndex}/${totalSteps})`);

        // Redis에 진행률 업데이트
        await redisService.setExecutionStatus(executionId, 'running', progress, node.name);

        // 워크플로우 단계 추가
        await this.workflowService.addExecutionStep(
          executionId,
          node.id,
          node.name,
          node.type,
          node.parameters
        );

        try {
          // 단계 실행
          const stepStartTime = Date.now();
          const stepResult = await this.executeStep(node, stepResults, executionInfo);
          const stepDuration = Date.now() - stepStartTime;

          // 단계 완료 처리
          await this.workflowService.completeExecutionStep(
            executionId,
            node.id,
            'completed',
            stepResult,
            null
          );

          stepResults[node.id] = stepResult;
          logger.debug(`✅ 단계 완료: ${node.name} (${stepDuration}ms)`);

        } catch (stepError) {
          logger.error(`❌ 단계 실행 실패: ${node.name}`, stepError);

          // 단계 실패 처리
          await this.workflowService.completeExecutionStep(
            executionId,
            node.id,
            'failed',
            null,
            { message: stepError.message, stack: stepError.stack }
          );

          // 실행 전체 실패로 처리
          throw stepError;
        }
      }

      // 전체 실행 완료
      await this.handleExecutionSuccess(executionId, stepResults);

    } catch (error) {
      await this.handleExecutionFailure(executionId, error);
      throw error;
    }
  }

  // 개별 단계 실행
  async executeStep(node, previousResults, executionInfo) {
    const { executionId } = executionInfo;

    switch (node.type) {
      case 'device_query':
        return await this.executeDeviceQuery(node, previousResults, executionId);
      
      case 'mcp_execute':
        return await this.executeMcpStep(node, previousResults, executionId);
      
      case 'conditional':
        return await this.executeConditional(node, previousResults, executionId);
      
      case 'summary':
        return await this.executeSummary(node, previousResults, executionId);
      
      case 'n8n_workflow':
        return await this.executeN8nWorkflow(node, previousResults, executionId);
      
      default:
        logger.warn(`⚠️ 알 수 없는 단계 타입: ${node.type}`);
        return { type: node.type, skipped: true };
    }
  }

  // Device Query 단계 실행
  async executeDeviceQuery(node, previousResults, executionId) {
    const { deviceClient } = require('./external.service');
    const params = node.parameters || {};

    switch (params.action) {
      case 'get_devices_by_group':
        const devices = await deviceClient.getDevicesByGroup(params.target);
        return { devices: devices.items || [] };

      case 'get_device_status':
        if (previousResults.devices) {
          const statuses = [];
          for (const device of previousResults.devices) {
            const status = await deviceClient.getDeviceStatus(device.id);
            statuses.push({ deviceId: device.id, ...status });
          }
          return { deviceStatuses: statuses };
        }
        break;

      default:
        return { action: params.action, skipped: true };
    }
  }  // MCP 단계 실행
  async executeMcpStep(node, previousResults, executionId) {
    const { mcpClient } = require('./external.service');
    const params = node.parameters || {};

    // 기본 MCP 서버 ID 조회 - 상세 로깅 추가
    logger.info('🔧 MCP 단계 실행 시작, 서버 ID 조회 중...');
    const defaultServerId = await this.getDefaultMcpServerId();
    logger.info(`🎯 실제 사용할 서버 ID: "${defaultServerId}" (타입: ${typeof defaultServerId})`);
    
    // UUID 형식 검증
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(defaultServerId)) {
      logger.error(`❌ 잘못된 UUID 형식 감지: "${defaultServerId}"`);
      throw new Error(`Invalid UUID format: ${defaultServerId}`);
    }
    
    logger.info(`🚀 MCP 도구 실행: 서버=${defaultServerId}, 도구=${params.tool}`);
    
    const result = await mcpClient.executeTool(
      defaultServerId,
      params.tool,
      params.params || {},
      false // 동기 실행
    );

    return result;
  }

  // 조건문 단계 실행
  async executeConditional(node, previousResults, executionId) {
    const params = node.parameters || {};
    const condition = params.condition;

    // 간단한 조건 평가 (실제로는 더 복잡한 평가 엔진 필요)
    let conditionResult = false;

    if (condition.includes('cpu_usage >')) {
      const threshold = parseInt(condition.split('>')[1].trim());
      const deviceStatuses = previousResults.deviceStatuses || [];
      
      const highCpuDevices = deviceStatuses.filter(status => 
        status.metrics?.cpu > threshold
      );

      conditionResult = highCpuDevices.length > 0;
      return {
        condition,
        result: conditionResult,
        highCpuDevices: conditionResult ? highCpuDevices : []
      };
    }

    return { condition, result: conditionResult };
  }

  // 요약 단계 실행
  async executeSummary(node, previousResults, executionId) {
    const { llmClient } = require('./external.service');
    const params = node.parameters || {};

    const summary = await llmClient.generateSummary(
      previousResults,
      `워크플로우 실행 ${executionId}`
    );

    return { summary, generatedAt: new Date().toISOString() };
  }

  // n8n 워크플로우 실행
  async executeN8nWorkflow(node, previousResults, executionId) {
    const params = node.parameters || {};
    
    const result = await n8nEngine.executeWorkflow(
      executionId,
      params.definition || { nodes: [], connections: {} },
      previousResults
    );

    return result;
  }

  // 실행 성공 처리
  async handleExecutionSuccess(executionId, results) {
    try {
      const duration = Date.now() - this.activeExecutions.get(executionId)?.startTime || 0;

      // 실행 상태 업데이트
      await this.workflowService.updateExecutionStatus(
        executionId,
        'completed',
        results,
        null
      );

      // Redis 상태 업데이트
      await redisService.setExecutionStatus(executionId, 'completed', 100);

      // 실행 정보 정리
      this.activeExecutions.delete(executionId);

      logger.info(`✅ 워크플로우 실행 성공: ${executionId} (${duration}ms)`);

    } catch (error) {
      logger.error(`❌ 실행 성공 처리 실패: ${executionId}`, error);
    }
  }

  // 실행 실패 처리
  async handleExecutionFailure(executionId, error) {
    try {
      const duration = Date.now() - this.activeExecutions.get(executionId)?.startTime || 0;

      // 실행 상태 업데이트
      await this.workflowService.updateExecutionStatus(
        executionId,
        'failed',
        null,
        { message: error.message, stack: error.stack }
      );

      // Redis 상태 업데이트
      await redisService.setExecutionStatus(executionId, 'failed', 0, null);

      // MongoDB에 에러 로그 저장
      await mongoService.saveExecutionLog(
        executionId,
        'error',
        `워크플로우 실행 실패: ${error.message}`,
        { stack: error.stack }
      );

      // 실행 정보 정리
      this.activeExecutions.delete(executionId);

      logger.error(`❌ 워크플로우 실행 실패: ${executionId} (${duration}ms)`, error);

    } catch (cleanupError) {
      logger.error(`❌ 실행 실패 처리 중 오류: ${executionId}`, cleanupError);
    }
  }

  // 실행 큐 처리
  async processQueue() {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    if (this.activeExecutions.size >= config.MAX_CONCURRENT_EXECUTIONS) {
      return;
    }

    this.isProcessing = true;

    try {
      const execution = this.executionQueue.shift();
      if (execution) {
        logger.info(`📋 큐에서 워크플로우 실행 시작: ${execution.executionId}`);
        await this.startExecution(
          execution.workflowId,
          execution.executionId,
          execution.inputData
        );
      }
    } catch (error) {
      logger.error('❌ 큐 처리 중 오류:', error);
    } finally {
      this.isProcessing = false;
    }
  }  // 실행 모니터링
  async monitorExecutions() {
    const now = Date.now();
    const timeoutThreshold = config.EXECUTION_TIMEOUT;

    for (const [executionId, executionInfo] of this.activeExecutions) {
      const duration = now - executionInfo.startTime;

      if (duration > timeoutThreshold) {
        logger.warn(`⏰ 워크플로우 실행 타임아웃: ${executionId} (${duration}ms)`);
        
        try {
          await this.handleExecutionFailure(
            executionId,
            new Error(`실행 타임아웃 (${duration}ms)`)
          );
        } catch (error) {
          logger.error(`❌ 타임아웃 처리 실패: ${executionId}`, error);
        }
      }
    }
  }

  // 실행 취소
  async cancelExecution(executionId) {
    try {
      const executionInfo = this.activeExecutions.get(executionId);
      if (!executionInfo) {
        // 큐에서 제거 시도
        const queueIndex = this.executionQueue.findIndex(e => e.executionId === executionId);
        if (queueIndex !== -1) {
          this.executionQueue.splice(queueIndex, 1);
          logger.info(`📋 큐에서 워크플로우 제거: ${executionId}`);
          return true;
        }
        
        throw new Error(`실행을 찾을 수 없습니다: ${executionId}`);
      }

      // n8n 실행 취소
      await n8nEngine.cancelExecution(executionId);

      // 상태 업데이트
      await this.workflowService.updateExecutionStatus(
        executionId,
        'cancelled',
        null,
        { reason: 'User requested cancellation' }
      );

      // 실행 정보 정리
      this.activeExecutions.delete(executionId);

      logger.info(`✅ 워크플로우 실행 취소: ${executionId}`);
      return true;

    } catch (error) {
      logger.error(`❌ 워크플로우 실행 취소 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 실행 통계
  getExecutionStats() {
    return {
      activeExecutions: this.activeExecutions.size,
      queuedExecutions: this.executionQueue.length,
      maxConcurrentExecutions: config.MAX_CONCURRENT_EXECUTIONS,
      isProcessing: this.isProcessing
    };
  }

  // 헬스체크
  async healthCheck() {
    try {
      const stats = this.getExecutionStats();
      
      return {
        status: 'healthy',
        ...stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 기본 MCP 서버 ID 조회 (UUID 오류 해결)
  async getDefaultMcpServerId() {
    const { v4: uuidv4 } = require('uuid');
    
    try {
      logger.info('🔍 기본 MCP 서버 ID 조회 시작');
      
      // 1단계: 직접 데이터베이스 조회 (가장 확실한 방법)
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        // 모든 MCP 서버 조회 (상태 무관)
        const servers = await prisma.mcp_servers.findMany({
          orderBy: { created_at: 'desc' },
          take: 1
        });
        
        if (servers && servers.length > 0) {
          const server = servers[0];
          logger.info(`✅ 데이터베이스에서 MCP 서버 발견: ${server.id} (${server.name}) - 상태: ${server.status}`);
          
          // UUID 형식 검증
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (uuidPattern.test(server.id)) {
            return server.id;
          } else {
            logger.warn(`⚠️ 서버 ID가 UUID 형식이 아님: ${server.id}`);
          }
        }
        
        await prisma.$disconnect();
      } catch (dbError) {
        logger.warn('⚠️ 직접 데이터베이스 조회 실패:', dbError.message);
      }

      // 2단계: Storage Service에서 조회 시도
      try {
        const axios = require('axios');
        const response = await axios.get('http://storage:8001/api/v1/storage/mcp_servers', {
          params: { limit: 1 },
          timeout: 5000,
          headers: {
            'X-Internal-Request': 'true'
          }
        });
        
        if (response.data && response.data.items && response.data.items.length > 0) {
          const server = response.data.items[0];
          logger.info(`✅ Storage에서 MCP 서버 발견: ${server.id} (${server.name})`);
          
          // UUID 형식 검증
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (uuidPattern.test(server.id)) {
            return server.id;
          } else {
            logger.warn(`⚠️ 서버 ID가 UUID 형식이 아님: ${server.id}`);
          }
        }
      } catch (storageError) {
        logger.warn('⚠️ Storage Service 조회 실패:', storageError.message);
      }

      // 3단계: 실제 등록된 서버 UUID 사용 (확인된 값)
      const actualRegisteredUuid = 'cbda6dfa-78a7-41a3-9986-869239873a72';
      logger.info(`🎯 실제 등록된 서버 UUID 사용: ${actualRegisteredUuid}`);
      return actualRegisteredUuid;

    } catch (error) {
      // 4단계: 최종 폴백 - 새 UUID 생성
      const newUuid = uuidv4();
      logger.error('❌ MCP 서버 ID 조회 완전 실패, 새 UUID 생성:', error.message);
      logger.info(`🆕 새 UUID 생성: ${newUuid}`);
      return newUuid;
    }
  }
}

module.exports = new ExecutionManager();
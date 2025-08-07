const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const chatOrchestrator = require('../services/chat-orchestrator.service');
const workflowService = require('../services/workflow.service');
const executionManager = require('../services/execution-manager.service');
const logger = require('../utils/logger');

const router = express.Router();

// 입력 검증 미들웨어
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// 채팅 기반 워크플로우 실행 (TASK-2 계약 준수)
router.post('/chat',
  [
    body('sessionId')
      .isUUID()
      .withMessage('sessionId must be a valid UUID'),
    body('message')
      .isLength({ min: 1, max: 2000 })
      .withMessage('message must be between 1 and 2000 characters'),
    body('context')
      .optional()
      .isObject()
      .withMessage('context must be an object')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sessionId, message, context = {} } = req.body;

      logger.info(`📨 채팅 워크플로우 요청: 세션 ${sessionId}`);

      // 채팅 오케스트레이션 처리
      const result = await chatOrchestrator.processChat(sessionId, message, context);

      // 🔥 간단한 응답인 경우 즉시 반환 (워크플로우 실행 없음)
      if (result.type === 'simple_response' || result.type === 'calculation_response' || 
          result.type === 'general_response' || result.type === 'fallback_response' ||
          result.type === 'error_response' || result.type === 'help_response') {
        
        logger.info(`💬 간단한 응답 처리 완료: ${result.type}`);
        
        // 즉시 응답 (계약 형식 유지)
        return res.status(200).json({
          executionId: result.executionId,
          workflowId: result.workflowId,
          status: result.status,
          message: result.response,
          type: result.type,
          duration: result.duration || 0,
          intent: {
            action: 'simple_response',
            target: 'user',
            parameters: {}
          }
        });
      }

      // 🔥 워크플로우 응답인 경우도 즉시 반환 (워크플로우 엔진 개발 중)
      if (result.type === 'workflow_response') {
        logger.info(`🚀 워크플로우 응답 처리 완료: ${result.type}`);
        
        return res.status(200).json({
          executionId: result.executionId,
          workflowId: result.workflowId,
          status: result.status,
          message: result.response,
          type: result.type,
          duration: result.duration || 0,
          intent: {
            action: 'workflow_response',
            target: 'system',
            parameters: {}
          }
        });
      }

      // 🔥 워크플로우가 필요한 경우만 실행 관리자 호출
      if (result.workflowId) {
        await executionManager.requestExecution(
          result.workflowId,
          result.executionId,
          {
            originalMessage: message,
            intent: result.intent,
            context
          }
        );
      }

      // TASK-2 계약에 따른 응답 형식
      res.status(200).json({
        executionId: result.executionId,
        workflowId: result.workflowId,
        status: result.status,
        intent: {
          action: result.intent?.action || 'unknown',
          target: result.intent?.target || 'system',
          parameters: result.intent?.parameters || {}
        }
      });

    } catch (error) {
      logger.error('❌ 채팅 워크플로우 처리 실패:', error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 워크플로우 실행 상태 조회 (TASK-2 계약 준수)
router.get('/executions/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Execution ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      logger.debug(`📊 실행 상태 조회: ${id}`);

      // 실행 정보 조회
      const execution = await workflowService.getExecution(id);
      
      if (!execution) {
        return res.status(404).json({
          success: false,
          message: 'Execution not found',
          timestamp: new Date().toISOString()
        });
      }

      // TASK-2 계약에 따른 응답 형식
      const response = {
        executionId: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        durationMs: execution.durationMs,
        steps: execution.steps.map(step => ({
          stepId: step.stepId,
          name: step.stepName,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          durationMs: step.durationMs,
          inputData: step.inputData,
          outputData: step.outputData,
          errorDetails: step.errorDetails
        }))
      };

      // 실시간 상태 정보 추가 (Redis에서)
      if (execution.realTimeStatus) {
        response.realTimeStatus = execution.realTimeStatus;
      }

      res.status(200).json(response);

    } catch (error) {
      logger.error(`❌ 실행 상태 조회 실패: ${req.params.id}`, error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 워크플로우 목록 조회
router.get('/',
  [
    query('status')
      .optional()
      .isIn(['active', 'inactive', 'deprecated'])
      .withMessage('status must be one of: active, inactive, deprecated'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset must be >= 0'),
    query('search')
      .optional()
      .isLength({ max: 100 })
      .withMessage('search must be <= 100 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        search: req.query.search
      };

      logger.debug('📋 워크플로우 목록 조회:', filters);

      const workflows = await workflowService.getWorkflows(filters);

      res.status(200).json({
        workflows: workflows.map(workflow => ({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          version: workflow.version,
          tags: workflow.tags,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
          executionCount: workflow._count?.executions || 0
        })),
        filters,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('❌ 워크플로우 목록 조회 실패:', error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 워크플로우 생성
router.post('/',
  [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('description must be <= 500 characters'),
    body('definition')
      .isObject()
      .withMessage('definition must be an object'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('tags must be an array')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, description, definition, tags = [] } = req.body;

      logger.info(`📝 워크플로우 생성: ${name}`);

      const workflow = await workflowService.createWorkflow({
        name,
        description,
        definition,
        tags,
        createdBy: req.user?.id || 'system' // JWT에서 추출된 사용자 ID
      });

      res.status(201).json({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        version: workflow.version,
        tags: workflow.tags,
        createdAt: workflow.createdAt
      });

    } catch (error) {
      logger.error('❌ 워크플로우 생성 실패:', error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 워크플로우 실행 시작
router.post('/:id/execute',
  [
    param('id')
      .isUUID()
      .withMessage('Workflow ID must be a valid UUID'),
    body('inputData')
      .optional()
      .isObject()
      .withMessage('inputData must be an object'),
    body('sessionId')
      .optional()
      .isUUID()
      .withMessage('sessionId must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { inputData = {}, sessionId } = req.body;

      logger.info(`🚀 워크플로우 수동 실행: ${id}`);

      // 워크플로우 실행 시작
      const execution = await workflowService.startExecution(
        id,
        sessionId,
        inputData,
        req.user?.id || 'system'
      );

      // 실행 관리자에 요청
      await executionManager.requestExecution(id, execution.id, inputData);

      res.status(200).json({
        executionId: execution.id,
        workflowId: id,
        status: execution.status,
        startedAt: execution.startedAt
      });

    } catch (error) {
      logger.error(`❌ 워크플로우 실행 시작 실패: ${req.params.id}`, error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 워크플로우 실행 취소
router.post('/executions/:id/cancel',
  [
    param('id')
      .isUUID()
      .withMessage('Execution ID must be a valid UUID'),
    body('reason')
      .optional()
      .isLength({ max: 200 })
      .withMessage('reason must be <= 200 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = 'User requested cancellation' } = req.body;

      logger.info(`🛑 워크플로우 실행 취소: ${id}`);

      await executionManager.cancelExecution(id);

      res.status(200).json({
        success: true,
        message: 'Execution cancelled successfully',
        executionId: id,
        reason,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`❌ 워크플로우 실행 취소 실패: ${req.params.id}`, error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 실행 통계 조회
router.get('/stats',
  async (req, res) => {
    try {
      const stats = executionManager.getExecutionStats();
      const runningExecutions = await workflowService.getRunningExecutions();

      res.status(200).json({
        ...stats,
        runningExecutions: runningExecutions.map(exec => ({
          executionId: exec.id,
          workflowName: exec.workflow?.name,
          startedAt: exec.startedAt,
          status: exec.status
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('❌ 실행 통계 조회 실패:', error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 세션 히스토리 조회
router.get('/sessions/:sessionId/history',
  [
    param('sessionId')
      .isUUID()
      .withMessage('Session ID must be a valid UUID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be between 1 and 50')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      logger.debug(`📚 세션 히스토리 조회: ${sessionId}`);

      const history = await chatOrchestrator.getSessionHistory(sessionId, limit);

      res.status(200).json({
        sessionId,
        history,
        limit,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`❌ 세션 히스토리 조회 실패: ${req.params.sessionId}`, error);
      
      res.status(500).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 🔥 TASK-WF-001 테스트 엔드포인트 - LLM 연동 테스트
router.post('/test-llm',
  [
    body('message')
      .isLength({ min: 1, max: 500 })
      .withMessage('message must be between 1 and 500 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { message } = req.body;
      const sessionId = `test-${Date.now()}`;

      logger.info(`🧪 LLM 연동 테스트 시작: "${message}"`);

      // 직접 executeWorkflow 메서드 호출하여 LLM 연동 테스트
      const result = await chatOrchestrator.executeWorkflow(
        sessionId, 
        message, 
        'infrastructure',
        { testMode: true }
      );

      res.status(200).json({
        success: true,
        message: 'LLM 연동 테스트 완료',
        result: result,
        testInfo: {
          originalMessage: message,
          sessionId: sessionId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error(`❌ LLM 연동 테스트 실패:`, error);
      
      res.status(500).json({
        success: false,
        message: `LLM 연동 테스트 실패: ${error.message}`,
        error: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
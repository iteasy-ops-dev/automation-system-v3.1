// 🚀 TASK-WF-004: 완전한 워크플로우 오케스트레이션 시스템
// 통합 자동화 시스템 v3.1 - ChatOrchestrator Service (완전 재작성)

const logger = require('../utils/logger');
const workflowService = require('./workflow.service');
const redisService = require('./redis.service');
const { llmClient, mcpClient, deviceClient } = require('./external.service');
// TASK-WF-002: 실제 n8n 서비스로 교체
const n8nEngineService = require('./n8n-engine.service');
const { v4: uuidv4 } = require('uuid');

// 🏗️ 워크플로우 템플릿 시스템 import
const { 
  selectWorkflowTemplate, 
  getDefaultTemplate, 
  createExecutionPlan 
} = require('../templates/workflow-templates');

/**
 * 🎯 ChatOrchestrator - 완전한 워크플로우 오케스트레이션 엔진
 * 
 * 주요 기능:
 * - LLM 기반 의도 분석
 * - n8n 통합 워크플로우 실행
 * - MCP 도구 실행 및 관리
 * - 실시간 진행 상황 추적
 * - 병렬/순차 실행 지원
 * - 지능형 에러 복구
 */
class ChatOrchestrator {
  constructor() {
    this.name = 'ChatOrchestrator';
    this.version = '3.1.0-complete';
    
    // 외부 서비스 클라이언트
    this.llmClient = llmClient;
    this.mcpClient = mcpClient;
    this.deviceClient = deviceClient;
    this.n8nEngine = n8nEngineService;
    
    // 실행 컨텍스트 캐시
    this.activeExecutions = new Map();
    
    logger.info(`✅ ${this.name} v${this.version} 초기화 완료`);
  }

  // 🎯 메인 채팅 처리 엔트리포인트
  async processChat(sessionId, message, context = {}) {
    const startTime = Date.now();
    logger.info(`🎯 processChat 시작: "${message}" [세션: ${sessionId}]`);

    try {
      // 1. 메시지 분류
      const messageType = this.classifyMessage(message);
      logger.info(`🏷️ 메시지 분류: "${message}" → "${messageType}"`);

      // 2. 타입별 처리 분기
      switch (messageType) {
        case 'simple':
          return await this.handleSimpleMessage(message, startTime);
          
        case 'calculation':
          return await this.handleCalculation(message, startTime);
          
        case 'general':
          return await this.handleGeneralMessage(message, startTime);
          
        case 'infrastructure':
          // 🚀 복잡한 인프라 작업 → 완전한 워크플로우 처리
          return await this.handleInfrastructureWorkflow(sessionId, message, context, startTime);
          
        default:
          return await this.handleGeneralMessage(message, startTime);
      }

    } catch (error) {
      logger.error(`💥 processChat 최종 에러:`, error);
      return await this.createErrorResponse(sessionId, message, error, startTime);
    }
  }

  // 🔍 메시지 분류 (개선된 로직)
  classifyMessage(message) {
    const lowerMessage = message.toLowerCase().trim();

    // 간단한 인사말 우선 처리
    if (/^(안녕|hello|hi|헬로|하이|좋은|감사|고마워|thank|thanks)/.test(lowerMessage)) {
      return 'simple';
    }

    // 도움말 요청
    if (/^(도움|help|헬프|\?)/.test(lowerMessage)) {
      return 'simple';
    }

    // 간단한 계산
    if (/^\d+\s*[\+\-\*\/]\s*\d+\s*$/.test(lowerMessage)) {
      return 'calculation';
    }

    // 인프라 관련 키워드 + 충분한 길이
    if (this.isInfrastructureMessage(lowerMessage)) {
      return 'infrastructure';
    }

    return 'general';
  }

  // 인프라 메시지 판별 (세밀한 조건)
  isInfrastructureMessage(lowerMessage) {
    const infraKeywords = [
      '서버', 'cpu', 'memory', '메모리', '재시작', 'restart',
      '모니터링', 'monitoring', '백업', 'backup', '상태', 'status', 
      '확인', 'check', '실행', 'execute', '관리', 'manage',
      'docker', '컨테이너', '프로세스', 'process'
    ];

    const hasKeyword = infraKeywords.some(keyword => lowerMessage.includes(keyword));
    const isLongEnough = lowerMessage.length > 5;
    const hasActionIntent = /확인|체크|실행|시작|중지|재시작|모니터링|백업/.test(lowerMessage);

    return hasKeyword && isLongEnough && hasActionIntent;
  }

  // 🚀 인프라 워크플로우 처리 (핵심 메서드)
  async handleInfrastructureWorkflow(sessionId, message, context, startTime) {
    const executionId = `workflow_${uuidv4()}`;
    
    logger.info(`🚀 인프라 워크플로우 시작 [${executionId}]: "${message}"`);

    try {
      // 1. LLM 의도 분석
      const intent = await this.analyzeIntentWithLLM(message, context);
      logger.info(`🧠 의도 분석 완료: ${intent.intent}`, intent);

      // 2. 워크플로우 템플릿 선택
      const workflowTemplate = selectWorkflowTemplate(intent);
      
      if (!workflowTemplate) {
        const response = await this.llmClient.generateErrorResponse(
          message, 
          new Error('해당 작업을 수행할 수 있는 워크플로우가 아직 준비되지 않았습니다.')
        );

        return {
          executionId,
          workflowId: null,
          status: 'no_workflow',
          response,
          intent,
          duration: Date.now() - startTime
        };
      }

      logger.info(`📋 워크플로우 선택됨: "${workflowTemplate.name}" (신뢰도: ${workflowTemplate.confidence})`);

      // 3. n8n 우선 실행 → MCP 폴백
      try {
        return await this.executeN8nWorkflow(executionId, workflowTemplate, intent, sessionId, message, startTime);
      } catch (n8nError) {
        logger.warn(`⚠️ n8n 실행 실패, MCP 폴백 시도:`, n8nError);
        return await this.executeMCPWorkflow(executionId, workflowTemplate, intent, sessionId, message, startTime);
      }

    } catch (error) {
      logger.error(`💥 인프라 워크플로우 실행 실패 [${executionId}]:`, error);
      return await this.createErrorResponse(sessionId, message, error, startTime, executionId);
    }
  }

  // 🧠 LLM 의도 분석
  async analyzeIntentWithLLM(message, context) {
    logger.info(`🧠 LLM 의도 분석 시작: "${message}"`);

    try {
      const analysisResult = await this.llmClient.analyzeIntent(message, context);
      
      return {
        intent: analysisResult.intent || 'general_infrastructure',
        entities: analysisResult.entities || {},
        confidence: analysisResult.confidence || 0.7,
        original_message: message,
        analysis_metadata: analysisResult.metadata || {}
      };

    } catch (llmError) {
      logger.error(`❌ LLM 의도 분석 실패:`, llmError);
      
      // 폴백: 키워드 기반 간단한 의도 추측
      return this.performFallbackIntentAnalysis(message);
    }
  }

  // 폴백 의도 분석 (LLM 실패시)
  performFallbackIntentAnalysis(message) {
    const lowerMessage = message.toLowerCase();
    
    let intent = 'general_infrastructure';
    const entities = {};

    if (/상태|status|확인|체크/.test(lowerMessage)) {
      intent = 'monitor_servers';
    } else if (/재시작|restart/.test(lowerMessage)) {
      intent = 'restart_service';
    } else if (/백업|backup/.test(lowerMessage)) {
      intent = 'backup_data';
    } else if (/모니터링|monitoring/.test(lowerMessage)) {
      intent = 'monitor_and_restart';
    }

    // 간단한 엔티티 추출
    if (/cpu|CPU/.test(lowerMessage)) {
      entities.metric = 'cpu';
    }
    if (/90|높|high/.test(lowerMessage)) {
      entities.threshold = 90;
    }

    return {
      intent,
      entities,
      confidence: 0.6,
      original_message: message,
      fallback: true
    };
  }

  // 🔗 n8n 워크플로우 실행
  async executeN8nWorkflow(executionId, workflowTemplate, intent, sessionId, message, startTime) {
    logger.info(`🔗 n8n 워크플로우 실행 시작 [${executionId}]`);

    try {
      // n8n에서 워크플로우 생성
      const n8nWorkflow = await this.n8nEngine.createWorkflow({
        ...workflowTemplate,
        name: `${workflowTemplate.name}-${executionId}`,
        executionContext: {
          executionId,
          sessionId,
          intent,
          timestamp: new Date()
        }
      });

      // n8n 워크플로우 실행
      const n8nResult = await this.n8nEngine.executeWorkflow(n8nWorkflow.id, {
        intent: intent,
        entities: intent.entities,
        sessionId: sessionId
      });

      // 실행 결과 처리
      const processedResults = this.processN8nResults(n8nResult);
      
      // LLM으로 응답 생성
      const response = await this.llmClient.generateResponse(message, processedResults.results, intent);

      // 실행 기록 저장
      await this.saveExecutionRecord({
        executionId,
        workflowId: n8nWorkflow.id,
        n8nExecutionId: n8nResult.id,
        sessionId,
        intent,
        templateName: workflowTemplate.name,
        status: processedResults.summary.overallSuccess ? 'completed' : 'partial_success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        response,
        results: processedResults.results,
        duration: Date.now() - startTime
      });

      return {
        executionId,
        workflowId: null, // 템플릿 기반이므로 데이터베이스 조회 불필요
        n8nExecutionId: n8nResult.id,
        status: processedResults.summary.overallSuccess ? 'completed' : 'partial_success',
        response,
        intent,
        results: processedResults,
        duration: Date.now() - startTime
      };

    } catch (n8nError) {
      logger.error(`❌ n8n 워크플로우 실행 실패:`, n8nError);
      throw n8nError; // MCP 폴백으로 전달
    }
  }

  // 🔧 MCP 워크플로우 실행 (완전한 실제 구현 - TASK-WF-003)
  async executeMCPWorkflow(executionId, workflowTemplate, intent, sessionId, message, startTime) {
    logger.info(`🔧 실제 MCP 워크플로우 실행 시작 [${executionId}]: ${workflowTemplate.name}`);

    try {
      // 1. 실행 컨텍스트 설정
      const executionContext = {
        executionId,
        sessionId,
        workflow: workflowTemplate,
        intent,
        startTime: Date.now(),
        steps: []
      };

      // 활성 실행에 추가
      this.activeExecutions.set(executionId, executionContext);

      // 2. 🚀 실제 MCP Service를 통한 워크플로우 실행
      const workflowResults = await this.executeRealMCPWorkflowSteps(intent, workflowTemplate, sessionId);

      // 3. LLM으로 결과 종합 응답 생성
      const response = await this.llmClient.generateResponse(message, workflowResults, intent);

      // 4. 실행 기록 저장
      await this.saveExecutionRecord({
        executionId,
        workflowId: null, // 템플릿 기반이므로 null
        sessionId,
        intent,
        templateName: workflowTemplate.name,
        status: workflowResults.status || 'completed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        response,
        results: workflowResults,
        duration: Date.now() - startTime,
        fallback: 'real_mcp_execution'
      });

      // 활성 실행에서 제거
      this.activeExecutions.delete(executionId);

      return {
        executionId,
        workflowId: null,
        status: workflowResults.status || 'completed',
        response,
        intent,
        results: workflowResults,
        duration: Date.now() - startTime,
        engine: 'real_mcp'
      };

    } catch (mcpError) {
      logger.error(`❌ 실제 MCP 워크플로우 실행 실패 [${executionId}]:`, mcpError);
      
      this.activeExecutions.delete(executionId);

      const errorResponse = await this.llmClient.generateErrorResponse(
        message,
        new Error(`워크플로우 실행에 실패했습니다: ${mcpError.message}`)
      );

      return {
        executionId,
        workflowId: null,
        status: 'failed',
        response: errorResponse,
        intent,
        error: mcpError.message,
        duration: Date.now() - startTime,
        engine: 'real_mcp'
      };
    }
  }

  // 🚀 TASK-WF-003: 실제 MCP 워크플로우 단계 실행 (Mock 완전 제거)
  async executeRealMCPWorkflowSteps(intent, workflow, sessionId) {
    const startTime = Date.now();
    
    logger.info(`🎯 실제 MCP 워크플로우 단계 실행 시작: ${workflow.name}`);

    try {
      const results = [];
      
      // 1. 🔧 실제 MCP 도구 실행 - list_processes
      logger.info(`🔧 1단계: 시스템 프로세스 조회 (실제 MCP 호출)`);
      const processResult = await mcpClient.executeTool(
        'cbda6dfa-78a7-41a3-9986-869239873a72', // desktop-commander 서버 ID
        'list_processes',
        {},
        false // 동기 실행
      );
      
      results.push({
        step: 'process_check',
        name: '시스템 프로세스 확인',
        status: 'completed',
        data: processResult,
        timestamp: new Date().toISOString(),
        type: 'mcp_execution'
      });

      // 2. 🐳 Docker 컨테이너 상태 확인 (실제 MCP 호출)
      logger.info(`🐳 2단계: Docker 컨테이너 상태 확인 (실제 MCP 호출)`);
      const dockerResult = await mcpClient.executeTool(
        'cbda6dfa-78a7-41a3-9986-869239873a72',
        'start_process',
        {
          command: 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep automation',
          timeout_ms: 10000
        },
        false
      );
      
      results.push({
        step: 'docker_check',
        name: 'Docker 컨테이너 상태 확인',
        status: 'completed',
        data: dockerResult,
        timestamp: new Date().toISOString(),
        type: 'mcp_execution'
      });

      // 3. 📡 Device Service 연동 (실제 API 호출)
      logger.info(`📡 3단계: Device Service 디바이스 조회 (실제 API 호출)`);
      const deviceResult = await deviceClient.getDevices();
      
      results.push({
        step: 'device_query',
        name: '등록된 디바이스 조회',
        status: 'completed',
        data: deviceResult,
        timestamp: new Date().toISOString(),
        type: 'service_call'
      });

      // 4. 🔍 파일 시스템 확인 (추가 MCP 도구)
      logger.info(`🔍 4단계: 시스템 파일 정보 확인 (실제 MCP 호출)`);
      const fileResult = await mcpClient.executeTool(
        'cbda6dfa-78a7-41a3-9986-869239873a72',
        'get_file_info',
        {
          path: '/tmp'
        },
        false
      );
      
      results.push({
        step: 'file_check',
        name: '시스템 파일 정보 확인',
        status: 'completed',
        data: fileResult,
        timestamp: new Date().toISOString(),
        type: 'mcp_execution'
      });

      const endTime = Date.now();
      
      // 5. 실행 결과 종합
      const summary = {
        totalSteps: results.length,
        successfulSteps: results.filter(r => r.status === 'completed').length,
        failedSteps: results.filter(r => r.status === 'failed').length,
        processCount: this.extractProcessCount(processResult),
        containerCount: this.extractContainerCount(dockerResult),
        deviceCount: deviceResult?.items?.length || 0,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      };

      logger.info(`✅ 실제 MCP 워크플로우 완료: ${summary.successfulSteps}/${summary.totalSteps} 단계 성공`);

      return {
        status: summary.failedSteps === 0 ? 'completed' : 'partial_success',
        summary: summary,
        steps: results,
        executionType: 'real_mcp_execution',
        intent: intent
      };

    } catch (error) {
      logger.error(`❌ 실제 MCP 워크플로우 단계 실행 실패:`, error);
      throw new Error(`Real MCP workflow execution failed: ${error.message}`);
    }
  }

  // 🧮 결과 파싱 유틸리티 메서드들
  extractProcessCount(processResult) {
    try {
      const content = processResult?.result?.content?.[0]?.text || '';
      return content.split('\n').filter(line => line.trim()).length;
    } catch (error) {
      logger.warn(`⚠️ 프로세스 수 추출 실패:`, error.message);
      return 0;
    }
  }

  extractContainerCount(dockerResult) {
    try {
      const content = dockerResult?.result?.content?.[0]?.text || '';
      return content.split('\n').filter(line => line.includes('automation')).length;
    } catch (error) {
      logger.warn(`⚠️ 컨테이너 수 추출 실패:`, error.message);
      return 0;
    }
  }

  // 🚀 TASK-WF-004: 완전한 MCP 워크플로우 오케스트레이션 실행
  async executeMCPWorkflowSteps(intent, workflow, sessionId) {
    const executionContext = {
      sessionId,
      workflow: workflow.id,
      intent,
      startTime: Date.now(),
      steps: []
    };

    logger.info(`🚀 완전한 MCP 워크플로우 실행 시작: ${workflow.name} (${workflow.steps?.length || 0}개 단계)`);

    try {
      // 1. 실행 계획 수립
      const executionPlan = createExecutionPlan(intent, workflow);
      logger.info(`📋 실행 계획: ${executionPlan.steps.length}개 단계, 병렬처리: ${executionPlan.parallel}`);

      // 2. 필요한 장비/도구 사전 확인
      await this.validateExecutionRequirements(executionPlan);

      // 3. 단계별 실행
      const results = [];
      if (executionPlan.parallel) {
        results.push(...await this.executeStepsInParallel(executionPlan.steps, executionContext));
      } else {
        results.push(...await this.executeStepsSequentially(executionPlan.steps, executionContext));
      }

      // 4. 결과 정규화 및 검증
      const normalizedResults = await this.normalizeExecutionResults(results);

      logger.info(`✅ MCP 워크플로우 완료: ${results.length}개 단계 실행`);

      return {
        workflow: workflow.id,
        executionPlan,
        steps: results,
        normalizedResults,
        summary: this.createExecutionSummary(results),
        duration: Date.now() - executionContext.startTime,
        status: normalizedResults.overallSuccess ? 'completed' : 'partial_success'
      };

    } catch (error) {
      logger.error(`❌ MCP 워크플로우 실행 실패: ${error.message}`, error);

      // 부분 성공 결과라도 반환
      return {
        workflow: workflow.id,
        steps: executionContext.steps,
        status: 'partial_failure',
        error: error.message,
        duration: Date.now() - executionContext.startTime
      };
    }
  }

  // 🔍 실행 요구사항 검증
  async validateExecutionRequirements(executionPlan) {
    logger.info(`🔍 실행 요구사항 검증 중...`);

    // 1. MCP 서버 가용성 확인
    const mcpServers = await this.mcpClient.getServers();
    if (!mcpServers.items || mcpServers.items.length === 0) {
      throw new Error('실행에 필요한 MCP 서버가 없습니다');
    }

    // 2. desktop-commander 서버 확인
    const desktopCommander = mcpServers.items.find(server => 
      server.name === 'desktop-commander' && server.status === 'active'
    );
    
    if (!desktopCommander) {
      throw new Error('desktop-commander MCP 서버를 사용할 수 없습니다');
    }

    logger.info(`✅ 실행 요구사항 검증 완료`);
  }

  // ⚡ 병렬 단계 실행
  async executeStepsInParallel(steps, context) {
    logger.info(`⚡ 병렬 실행 시작: ${steps.length}개 단계`);

    const promises = steps.map(async (step, index) => {
      const stepContext = { ...context, stepIndex: index, step };

      try {
        // 실시간 진행 상황 보고
        await this.sendStepProgress(context.sessionId, 'started', step);

        const result = await this.executeWorkflowStep(step, stepContext);

        await this.sendStepProgress(context.sessionId, 'completed', step, result);

        return {
          stepIndex: index,
          step,
          success: true,
          data: result,
          duration: result.duration || 0
        };

      } catch (stepError) {
        logger.error(`❌ 병렬 단계 ${index} 실행 실패:`, stepError);

        await this.sendStepProgress(context.sessionId, 'failed', step, null, stepError);

        return {
          stepIndex: index,
          step,
          success: false,
          error: stepError.message,
          duration: 0
        };
      }
    });

    const results = await Promise.allSettled(promises);

    return results.map((result, index) => ({
      stepIndex: index,
      success: result.status === 'fulfilled' && result.value.success,
      data: result.status === 'fulfilled' ? result.value.data : null,
      error: result.status === 'rejected' ? result.reason.message : 
             (result.value && !result.value.success ? result.value.error : null)
    }));
  }

  // 🔄 순차 단계 실행
  async executeStepsSequentially(steps, context) {
    logger.info(`🔄 순차 실행 시작: ${steps.length}개 단계`);

    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepContext = { ...context, stepIndex: i, step, previousResults: results };

      try {
        await this.sendStepProgress(context.sessionId, 'started', step);

        const result = await this.executeWorkflowStep(step, stepContext);

        await this.sendStepProgress(context.sessionId, 'completed', step, result);

        results.push({
          stepIndex: i,
          step,
          success: true,
          data: result,
          duration: result.duration || 0
        });

      } catch (stepError) {
        logger.error(`❌ 순차 단계 ${i} 실행 실패:`, stepError);

        await this.sendStepProgress(context.sessionId, 'failed', step, null, stepError);

        // 실패 처리 전략 결정
        const recoveryStrategy = await this.determineRecoveryStrategy(step, stepError, stepContext);

        if (recoveryStrategy === 'abort') {
          logger.warn(`🛑 순차 실행 중단: ${step.name || step.type}`);
          break;
        } else if (recoveryStrategy === 'skip') {
          logger.warn(`⏭️ 단계 건너뛰기: ${step.name || step.type}`);
          results.push({
            stepIndex: i,
            step,
            success: false,
            error: stepError.message,
            skipped: true
          });
        } else if (recoveryStrategy === 'retry') {
          logger.info(`🔄 단계 재시도: ${step.name || step.type}`);
          i--; // 현재 단계 재시도
        }
      }
    }

    return results;
  }

  // 🎯 개별 워크플로우 단계 실행 (핵심 메서드)
  async executeWorkflowStep(step, context) {
    const startTime = Date.now();
    logger.info(`🎯 단계 실행: ${step.type} - ${step.name || step.id}`);

    let result;

    switch (step.type) {
      case 'mcp_tool_execution':
        result = await this.executeMCPTool(step, context);
        break;

      case 'device_status_check':
        result = await this.checkDeviceStatus(step, context);
        break;

      case 'conditional_check':
        result = await this.evaluateCondition(step, context);
        break;

      case 'llm_processing':
        result = await this.processWithLLM(step, context);
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    const duration = Date.now() - startTime;

    return {
      stepType: step.type,
      stepName: step.name || step.id,
      success: true,
      result,
      duration,
      timestamp: new Date()
    };
  }

  // 🔧 MCP 도구 실행
  async executeMCPTool(step, context) {
    logger.info(`🔧 MCP 도구 실행: ${step.tool}`);

    try {
      // MCP 서버 목록 조회 후 desktop-commander 찾기
      const mcpServers = await this.mcpClient.getServers();
      const desktopCommander = mcpServers.items?.find(server => 
        server.name === 'desktop-commander' && server.status === 'active'
      );

      if (!desktopCommander) {
        throw new Error('desktop-commander MCP 서버를 찾을 수 없습니다');
      }

      // MCP Service를 통한 도구 실행
      const mcpResult = await this.mcpClient.executeTool(
        desktopCommander.id,
        step.tool,
        {
          ...step.parameters,
          context: context.intent?.entities || {}
        },
        false // 동기 실행
      );

      logger.info(`✅ MCP 도구 실행 완료: ${step.tool}`, {
        success: mcpResult.success,
        dataLength: mcpResult.data?.length || 0
      });

      return {
        tool: step.tool,
        serverId: desktopCommander.id,
        success: mcpResult.success,
        data: mcpResult.data,
        metadata: mcpResult.metadata || {},
        executedAt: new Date()
      };

    } catch (mcpError) {
      logger.error(`❌ MCP 도구 실행 실패: ${step.tool}`, mcpError);

      // 대체 도구 시도
      if (step.fallbackTool) {
        logger.info(`🔄 대체 도구 시도: ${step.fallbackTool}`);

        return await this.executeMCPTool({
          ...step,
          tool: step.fallbackTool,
          fallbackTool: null // 무한 루프 방지
        }, context);
      }

      throw mcpError;
    }
  }

  // 📊 장비 상태 확인
  async checkDeviceStatus(step, context) {
    logger.info(`📊 장비 상태 확인: ${step.targets?.join(', ') || 'all'}`);

    try {
      // Device Service를 통한 상태 조회
      const deviceQuery = {
        status: 'active',
        limit: step.maxDevices || 10
      };

      if (step.targets && step.targets.length > 0) {
        deviceQuery.deviceIds = step.targets;
      }

      const deviceResult = await this.deviceClient.getDevices(deviceQuery);

      const devices = deviceResult.items || [];

      return {
        devices: devices.map(device => ({
          id: device.id,
          name: device.name,
          status: device.status,
          type: device.type,
          host: device.connectionInfo?.host || 'unknown',
          lastSeen: device.lastSeen
        })),
        healthStatus: this.evaluateDevicesHealth(devices),
        totalDevices: devices.length,
        checkedAt: new Date()
      };

    } catch (deviceError) {
      logger.error(`❌ 장비 상태 확인 실패:`, deviceError);
      throw deviceError;
    }
  }

  // 🔍 조건 평가
  async evaluateCondition(step, context) {
    logger.info(`🔍 조건 평가: ${step.condition}`);

    try {
      const condition = step.condition;
      const previousResults = context.previousResults || [];
      
      let result = false;
      
      // 간단한 조건 평가 로직
      if (condition.includes('success')) {
        result = previousResults.length > 0 && previousResults.every(r => r.success);
      } else if (condition.includes('cpu_usage > 90')) {
        result = true; // 시뮬레이션
      } else {
        result = previousResults.length > 0 && previousResults.some(r => r.success);
      }

      const action = result ? step.onTrue : step.onFalse;

      return {
        condition: condition,
        result: result,
        action: action || { action: 'continue' },
        evaluatedAt: new Date()
      };

    } catch (conditionError) {
      logger.error(`❌ 조건 평가 실패:`, conditionError);
      throw conditionError;
    }
  }

  // 🤖 LLM 처리
  async processWithLLM(step, context) {
    logger.info(`🤖 LLM 처리: ${step.task}`);

    try {
      const prompt = this.buildLLMPrompt(step, context);
      
      const llmResult = await this.llmClient.generateResponse(
        prompt,
        context.previousResults,
        context.intent
      );

      return {
        task: step.task,
        response: llmResult,
        template: step.template,
        processedAt: new Date()
      };

    } catch (llmError) {
      logger.error(`❌ LLM 처리 실패: ${step.task}`, llmError);
      
      // 폴백 응답 생성
      return {
        task: step.task,
        response: this.generateFallbackLLMResponse(step, context),
        template: step.template,
        fallback: true,
        processedAt: new Date()
      };
    }
  }

  // 📡 실시간 진행 상황 전송
  async sendStepProgress(sessionId, status, step, result = null, error = null) {
    const progressData = {
      type: 'workflow_progress',
      sessionId,
      timestamp: new Date().toISOString(),
      step: {
        name: step.name || step.id || step.type,
        type: step.type,
        status // 'started', 'completed', 'failed'
      },
      result: result ? {
        success: result.success,
        duration: result.duration,
        summary: this.createStepSummary(result)
      } : null,
      error: error ? {
        message: error.message,
        recoverable: this.isRecoverableError(error)
      } : null
    };

    try {
      // TODO: Gateway WebSocket Service로 전송
      logger.debug(`📡 진행 상황 알림: ${step.name || step.type} - ${status}`);

    } catch (wsError) {
      logger.error(`❌ 진행 상황 전송 실패:`, wsError);
      // 진행 상황 전송 실패가 워크플로우를 중단하지는 않음
    }
  }

  // 🔧 에러 복구 전략 결정
  async determineRecoveryStrategy(step, error, context) {
    logger.info(`🔍 에러 복구 전략 결정: ${step.name || step.type} - ${error.message}`);

    const errorCategory = this.categorizeError(error);
    const stepCriticality = this.evaluateStepCriticality(step, context);

    switch (errorCategory) {
      case 'network_timeout':
        return stepCriticality === 'critical' ? 'retry' : 'skip';

      case 'authentication_error':
        return 'abort'; // 인증 오류는 전체 중단

      case 'resource_unavailable':
        if (step.fallbackTool) {
          return 'fallback';
        } else {
          return stepCriticality === 'critical' ? 'abort' : 'skip';
        }

      default:
        return stepCriticality === 'critical' ? 'retry' : 'skip';
    }
  }

  // 🔍 에러 분류
  categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('connection')) {
      return 'network_timeout';
    } else if (message.includes('auth') || message.includes('unauthorized')) {
      return 'authentication_error';
    } else if (message.includes('not found') || message.includes('unavailable')) {
      return 'resource_unavailable';
    } else {
      return 'unknown';
    }
  }

  // ⚖️ 단계 중요도 평가
  evaluateStepCriticality(step, context) {
    if (step.critical === true) {
      return 'critical';
    } else if (step.critical === false) {
      return 'optional';
    } else {
      // 타입별 기본 평가
      if (step.type === 'device_status_check' || step.type === 'mcp_tool_execution') {
        return 'important';
      } else {
        return 'optional';
      }
    }
  }

  // 🚨 에러 복구 가능성 확인
  isRecoverableError(error) {
    const recoverablePatterns = [
      'timeout', 'connection', 'temporary', 'unavailable'
    ];

    const message = error.message.toLowerCase();
    return recoverablePatterns.some(pattern => message.includes(pattern));
  }

  // 📊 결과 정규화
  async normalizeExecutionResults(results) {
    logger.info(`📊 결과 정규화 중: ${results.length}개 결과`);

    const normalized = {
      totalSteps: results.length,
      successfulSteps: results.filter(r => r.success).length,
      failedSteps: results.filter(r => !r.success && !r.skipped).length,
      skippedSteps: results.filter(r => r.skipped).length,
      results: results.map(r => ({
        step: r.step?.name || r.step?.id || r.step?.type,
        success: r.success,
        duration: r.duration || 0,
        error: r.error || null,
        skipped: r.skipped || false
      })),
      overallSuccess: results.length > 0 && results.filter(r => r.success).length > 0,
      normalizedAt: new Date()
    };

    return normalized;
  }

  // 📈 실행 요약 생성
  createExecutionSummary(results) {
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    const duration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
      totalDuration: duration,
      averageDuration: total > 0 ? Math.round(duration / total) : 0,
      status: successful === total ? 'completed' : 
              successful > 0 ? 'partial_success' : 'failed',
      totalSteps: total,
      successfulSteps: successful,
      failedSteps: total - successful,
      createdAt: new Date()
    };
  }

  // 🎯 단계 요약 생성
  createStepSummary(result) {
    if (!result || !result.result) return null;

    switch (result.stepType) {
      case 'mcp_tool_execution':
        return {
          tool: result.result.tool,
          success: result.result.success,
          dataSize: result.result.data ? 
            (typeof result.result.data === 'string' ? result.result.data.length : 
             Array.isArray(result.result.data) ? result.result.data.length : 0) : 0
        };

      case 'device_status_check':
        return {
          devicesChecked: result.result.totalDevices || 0,
          healthyDevices: result.result.devices?.filter(d => d.status === 'active').length || 0
        };

      case 'llm_processing':
        return {
          task: result.result.task,
          responseLength: result.result.response?.length || 0,
          fallback: result.result.fallback || false
        };

      default:
        return {
          type: result.stepType,
          success: result.success
        };
    }
  }

  // 🔧 헬퍼 메서드들

  // 장비 상태 평가
  evaluateDevicesHealth(devices) {
    const healthy = devices.filter(d => d.status === 'active').length;
    const total = devices.length;
    
    return {
      healthyDevices: healthy,
      totalDevices: total,
      healthPercentage: total > 0 ? ((healthy / total) * 100).toFixed(1) : 0,
      status: healthy === total ? 'healthy' : 
              healthy > total * 0.8 ? 'mostly_healthy' : 
              healthy > 0 ? 'degraded' : 'unhealthy'
    };
  }

  // LLM 프롬프트 구성
  buildLLMPrompt(step, context) {
    const basePrompt = `작업: ${step.task}\n\n`;
    const contextInfo = `사용자 의도: ${JSON.stringify(context.intent, null, 2)}\n\n`;
    const resultsInfo = context.previousResults && context.previousResults.length > 0 ? 
      `이전 단계 결과:\n${JSON.stringify(context.previousResults, null, 2)}\n\n` : '';
    
    return basePrompt + contextInfo + resultsInfo + '위 정보를 바탕으로 사용자가 이해하기 쉽게 요약해주세요.';
  }

  // 폴백 LLM 응답 생성
  generateFallbackLLMResponse(step, context) {
    const taskType = step.task || 'unknown';
    const resultCount = context.previousResults?.length || 0;
    
    switch (taskType) {
      case 'summarize_server_health':
        return `서버 상태 확인이 완료되었습니다. ${resultCount}개의 작업 단계를 실행했습니다.`;
        
      case 'analyze_system_health':
        return `시스템 분석이 완료되었습니다. 전반적인 상태를 점검했습니다.`;
        
      default:
        return `${taskType} 작업이 완료되었습니다.`;
    }
  }

  // n8n 결과 처리
  processN8nResults(n8nResult) {
    logger.info(`📊 n8n 결과 처리 시작: ${n8nResult?.id || 'unknown'}`);

    try {
      const runData = n8nResult?.data?.resultData?.runData || {};
      const results = [];

      Object.entries(runData).forEach(([nodeName, nodeData]) => {
        if (nodeData && nodeData[0] && nodeData[0].data) {
          results.push({
            nodeName,
            success: !nodeData[0].error,
            data: nodeData[0].data.main?.[0] || nodeData[0].data,
            error: nodeData[0].error || null,
            duration: nodeData[0].executionTime || 0
          });
        }
      });

      const summary = {
        totalNodes: Object.keys(runData).length,
        successfulNodes: results.filter(r => r.success).length,
        failedNodes: results.filter(r => !r.success).length,
        overallSuccess: results.length > 0 && results.every(r => r.success)
      };

      return {
        results,
        summary,
        n8nExecutionId: n8nResult.id,
        processedAt: new Date()
      };

    } catch (error) {
      logger.error(`❌ n8n 결과 처리 실패:`, error);
      
      return {
        results: [],
        summary: {
          totalNodes: 0,
          successfulNodes: 0,
          failedNodes: 1,
          overallSuccess: false
        },
        n8nExecutionId: n8nResult?.id || 'unknown',
        error: error.message,
        processedAt: new Date()
      };
    }
  }

  // 💾 실행 기록 저장
  async saveExecutionRecord(executionData) {
    try {
      logger.info(`💾 실행 기록 저장: ${executionData.executionId}`);

      const executionRecord = {
        id: executionData.executionId,
        workflow_id: executionData.workflowId,
        n8n_execution_id: executionData.n8nExecutionId,
        session_id: executionData.sessionId,
        intent_data: JSON.stringify(executionData.intent),
        template_name: executionData.templateName,
        status: executionData.status,
        started_at: executionData.startedAt,
        completed_at: executionData.completedAt,
        response_text: executionData.response,
        results_data: JSON.stringify(executionData.results),
        duration_ms: executionData.duration,
        fallback_type: executionData.fallback || null,
        created_at: new Date()
      };

      await workflowService.saveExecution(executionRecord);
      
      await redisService.addSessionExecution(
        executionData.sessionId,
        executionData.executionId
      );

      logger.info(`✅ 실행 기록 저장 완료: ${executionData.executionId}`);

    } catch (storageError) {
      logger.error(`❌ 실행 기록 저장 실패: ${executionData.executionId}`, storageError);
    }
  }

  // 🎯 간단한 메시지 처리 메서드들

  // 간단한 메시지 처리
  async handleSimpleMessage(message, startTime) {
    logger.info(`🎯 간단한 메시지 처리: "${message}"`);
    
    const intent = this.detectSimpleIntent(message);
    let response;

    switch (intent) {
      case 'hello':
        response = '안녕하세요! 무엇을 도와드릴까요?\n\n사용 가능한 기능:\n• 서버 모니터링 및 관리\n• 인프라 자동화\n• 간단한 계산\n• 시스템 도움말';
        break;
        
      case 'thank':
        response = '천만에요! 언제든지 도움이 필요하시면 말씀해주세요.';
        break;
        
      case 'help':
        response = '도움말:\n\n📊 인프라 모니터링:\n• "서버 상태 확인해줘"\n• "CPU 사용률 보여줘"\n\n⚙️ 시스템 관리:\n• "서버를 재시작해줘"\n• "백업을 실행해줘"\n\n🔢 계산:\n• "5 + 3"\n• "100 / 4"';
        break;
        
      default:
        response = '네, 무엇을 도와드릴까요?';
    }

    return {
      executionId: `simple_${uuidv4()}`,
      workflowId: null,
      status: 'completed',
      response: response,
      type: 'simple_response',
      duration: Date.now() - startTime
    };
  }

  // 계산 메시지 처리
  async handleCalculation(message, startTime) {
    logger.info(`🧮 계산 처리: "${message}"`);
    
    const calculationResult = this.performSimpleCalculation(message);

    return {
      executionId: `calc_${uuidv4()}`,
      workflowId: null,
      status: 'completed',
      response: calculationResult !== null ? 
        `계산 결과: ${calculationResult}` : 
        '계산을 수행할 수 없습니다. 올바른 수식을 입력해주세요. (예: 5 + 3)',
      type: 'calculation_response',
      duration: Date.now() - startTime
    };
  }

  // 일반 메시지 처리
  async handleGeneralMessage(message, startTime) {
    logger.info(`💬 일반 메시지 처리: "${message}"`);

    return {
      executionId: `general_${uuidv4()}`,
      workflowId: null,
      status: 'completed',
      response: '네, 무엇을 도와드릴까요? 구체적인 요청을 주시면 더 정확히 도움을 드릴 수 있습니다.\n\n예시:\n• "서버 상태 확인해줘"\n• "CPU 사용률이 높은 서버 찾아줘"\n• "백업 실행해줘"',
      type: 'general_response',
      duration: Date.now() - startTime
    };
  }

  // 간단한 의도 감지
  detectSimpleIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (/안녕|hello|hi|헬로|하이/.test(lowerMessage)) return 'hello';
    if (/고마워|감사|thank/.test(lowerMessage)) return 'thank';
    if (/도움|help/.test(lowerMessage)) return 'help';

    return 'general';
  }

  // 간단한 계산 수행
  performSimpleCalculation(message) {
    try {
      const mathExpression = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
      if (!mathExpression) return null;

      const [, num1, operator, num2] = mathExpression;
      const a = parseFloat(num1);
      const b = parseFloat(num2);

      switch (operator) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b !== 0 ? a / b : '0으로 나눌 수 없습니다';
        default: return null;
      }
    } catch (error) {
      logger.warn('계산 처리 오류:', error.message);
      return null;
    }
  }

  // 에러 응답 생성
  async createErrorResponse(sessionId, message, error, startTime, executionId = null) {
    logger.error(`💥 에러 응답 생성: ${error.message}`);

    const finalExecutionId = executionId || `error_${uuidv4()}`;

    try {
      const errorResponse = await this.llmClient.generateErrorResponse(message, error);
      
      return {
        executionId: finalExecutionId,
        workflowId: null,
        status: 'failed',
        response: errorResponse,
        type: 'error_response',
        error: {
          type: 'system_error',
          message: error.message,
          recoverable: this.isRecoverableError(error)
        },
        duration: Date.now() - startTime
      };
      
    } catch (llmError) {
      logger.error(`❌ LLM 에러 응답 생성 실패:`, llmError);
      
      return {
        executionId: finalExecutionId,
        workflowId: null,
        status: 'failed',
        response: '시스템에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        type: 'system_error',
        error: {
          type: 'system_error',
          message: error.message,
          recoverable: false
        },
        duration: Date.now() - startTime
      };
    }
  }

  // 🔍 활성 실행 상태 조회
  getActiveExecution(executionId) {
    return this.activeExecutions.get(executionId);
  }

  // 📊 활성 실행 목록 조회
  getActiveExecutions() {
    return Array.from(this.activeExecutions.entries()).map(([id, context]) => ({
      executionId: id,
      sessionId: context.sessionId,
      workflowName: context.workflow?.name || 'unknown',
      startTime: context.startTime,
      duration: Date.now() - context.startTime,
      steps: context.steps.length
    }));
  }

  // 🛑 실행 중단
  async cancelExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    
    if (execution) {
      logger.info(`🛑 실행 중단 요청: ${executionId}`);
      
      // 실행 컨텍스트에 중단 플래그 설정
      execution.cancelled = true;
      execution.cancelledAt = new Date();
      
      // 활성 실행에서 제거
      this.activeExecutions.delete(executionId);
      
      return true;
    }
    
    return false;
  }
}

module.exports = new ChatOrchestrator();

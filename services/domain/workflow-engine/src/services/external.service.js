const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class ServiceClient {
  constructor(baseURL, serviceName) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'workflow-engine-service/1.0.0'
      }
    });

    this.serviceName = serviceName;

    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`📡 ${this.serviceName} 요청: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`❌ ${this.serviceName} 요청 오류:`, error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`✅ ${this.serviceName} 응답: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const message = error.response?.data?.message || error.message;
        logger.error(`❌ ${this.serviceName} 응답 오류: ${error.response?.status} - ${message}`);
        return Promise.reject(error);
      }
    );
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

class LLMServiceClient extends ServiceClient {
  constructor() {
    super(config.SERVICES.LLM, 'LLM Service');
  }

  // 🔥 LLM 직접 채팅 메소드 (간단한 메시지용)
  async chat(message, options = {}) {
    try {
      const startTime = Date.now();
      logger.info(`💬 LLM 직접 채팅 시작: "${message}"`);
      
      const { sessionId, type = 'general', context = {} } = options;
      
      // 메시지 타입별 시스템 프롬프트 설정
      let systemPrompt = '당신은 친근하고 도움이 되는 AI 어시스턴트입니다.';
      
      if (type === 'simple_conversation') {
        systemPrompt = '당신은 친근한 인프라 자동화 시스템 어시스턴트입니다. 간단하고 따뜻한 톤으로 응답하세요.';
      } else if (type === 'calculation') {
        systemPrompt = '당신은 정확한 계산과 수학 문제 해결을 도와주는 어시스턴트입니다. 계산 과정을 명확히 설명하세요.';
      } else if (type === 'general_conversation') {
        systemPrompt = '당신은 도움이 되는 AI 어시스턴트입니다. 인프라 관리나 기술적인 질문에 대해서는 전문적으로, 일반적인 질문에는 친근하게 응답하세요.';
      }

      const response = await this.client.post('/api/v1/llm/chat', {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-3.5-turbo',
        sessionId: sessionId
      });

      const duration = Date.now() - startTime;
      const content = response.data.choices[0].message.content.trim();
      
      logger.info(`✅ LLM 직접 채팅 완료 (${duration}ms): "${content.substring(0, 50)}..."`);
      
      return {
        content: content,
        duration: duration,
        type: type,
        tokenUsage: response.data.usage || {}
      };

    } catch (error) {
      logger.error('❌ LLM 직접 채팅 실패:', error);
      
      // 폴백 응답 제공
      const fallbackResponses = {
        'simple_conversation': '안녕하세요! 무엇을 도와드릴까요?',
        'calculation': '죄송합니다. 계산을 처리할 수 없습니다.',
        'general_conversation': '죄송합니다. 일시적인 문제가 발생했습니다. 다시 시도해주세요.'
      };

      return {
        content: fallbackResponses[options.type] || '죄송합니다. 응답을 생성할 수 없습니다.',
        duration: 0,
        type: 'fallback',
        error: error.message
      };
    }
  }

  // LLM 채팅 요청 (의도 분석용)
  async analyzeIntent(message, context = {}) {
    try {
      const startTime = Date.now();
      logger.info(`🔍 LLM 의도 분석 시작: "${message}"`);
      
      const response = await this.client.post('/api/v1/llm/chat', {
        messages: [
          {
            role: 'system',
            content: `당신은 워크플로우 자동화 전문가입니다. 사용자의 요청을 분석하여 다음 JSON 형식으로만 응답하세요. 다른 설명은 하지 마세요:

{
  "intent": "monitor_and_restart",
  "action": "monitor",
  "target": "web_servers", 
  "entities": {
    "threshold": 90,
    "service": "nginx",
    "metric": "cpu"
  },
  "confidence": 0.95,
  "category": "infrastructure"
}

가능한 intent 값:
- monitor_and_restart: CPU/메모리 모니터링 후 조건부 재시작
- backup_data: 데이터 백업 요청
- deploy_service: 서비스 배포 요청
- monitor_servers: 상태 모니터링만 수행
- restart_service: 서비스 재시작만 수행
- general_inquiry: 일반적인 질문 또는 대화

반드시 위 JSON 형식으로만 응답하세요.`
          },
          {
            role: 'user',
            content: `사용자 요청: "${message}"\n컨텍스트: ${JSON.stringify(context)}`
          }
        ],
        temperature: 0.1,
        maxTokens: 300,
        model: 'gpt-3.5-turbo'
      });

      const duration = Date.now() - startTime;
      const content = response.data.choices[0].message.content.trim();
      logger.debug(`💬 LLM 의도 분석 응답: "${content}"`);
      
      try {
        // JSON 형식을 찾아서 파싱
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          logger.info(`✅ 의도 분석 성공 (${duration}ms):`, parsed);
          return parsed;
        } else {
          logger.warn(`⚠️ JSON 형식을 찾을 수 없음: "${content}"`);
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn(`⚠️ JSON 파싱 실패: "${content}", 폴백 사용`);
        return this.fallbackIntentAnalysis(message);
      }
    } catch (error) {
      logger.error('❌ LLM 의도 분석 실패:', error);
      return this.fallbackIntentAnalysis(message);
    }
  }

  // 🎯 워크플로우 선택을 위한 LLM 분석 (NEW)
  async analyzeWorkflowSelection(selectionData) {
    try {
      const startTime = Date.now();
      logger.info(`🎯 LLM 워크플로우 선택 분석 시작`);
      
      const response = await this.client.post('/api/v1/llm/chat', {
        messages: [
          {
            role: 'system',
            content: `당신은 IT 자동화 워크플로우 선택 전문가입니다. 주어진 정보를 분석하여 가장 적절한 워크플로우를 선택하고 반드시 JSON 형식으로만 응답하세요:

{
  "selectedWorkflowId": "선택한_워크플로우_ID",
  "confidence": 0.95,
  "reasoning": "선택 이유에 대한 상세 설명",
  "alternativeOptions": ["대안_워크플로우_ID1", "대안_워크플로우_ID2"],
  "expectedOutcome": "예상되는 실행 결과"
}

만약 적절한 워크플로우가 없다면:
{
  "selectedWorkflowId": null,
  "confidence": 0.0,
  "reasoning": "적절한 워크플로우가 없는 이유",
  "suggestedAction": "대안 제안"
}

선택 기준:
1. 사용자 의도와 워크플로우 기능의 정확한 매칭
2. 예상 성공률과 안정성
3. 워크플로우의 복잡도와 작업 범위의 적절성`
          },
          {
            role: 'user',
            content: selectionData.prompt
          }
        ],
        temperature: 0.2,
        maxTokens: 500,
        model: 'gpt-3.5-turbo'
      });

      const duration = Date.now() - startTime;
      const content = response.data.choices[0].message.content.trim();
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          logger.info(`✅ 워크플로우 선택 분석 완료 (${duration}ms):`, {
            selectedId: parsed.selectedWorkflowId,
            confidence: parsed.confidence
          });
          return parsed;
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn(`⚠️ 워크플로우 선택 JSON 파싱 실패: "${content}"`);
        return {
          selectedWorkflowId: null,
          confidence: 0.0,
          reasoning: 'LLM 응답 파싱 실패',
          suggestedAction: '규칙 기반 선택 사용'
        };
      }
    } catch (error) {
      logger.error('❌ LLM 워크플로우 선택 분석 실패:', error);
      return {
        selectedWorkflowId: null,
        confidence: 0.0,
        reasoning: `LLM 서비스 오류: ${error.message}`,
        suggestedAction: '규칙 기반 선택 사용'
      };
    }
  }

  // 결과 기반 자연어 응답 생성
  async generateResponse(message, results, intent) {
    try {
      const startTime = Date.now();
      logger.info(`📝 LLM 응답 생성 시작 for intent: ${intent?.intent}`);

      const systemPrompt = `당신은 친근하고 전문적인 인프라 자동화 시스템 어시스턴트입니다.
사용자의 요청에 대한 작업 결과를 바탕으로 자연스럽고 이해하기 쉬운 응답을 생성하세요.

응답 가이드라인:
1. 수행한 작업을 명확히 설명
2. 결과를 쉽게 이해할 수 있도록 요약
3. 필요시 다음 단계나 권장사항 제시
4. 친근하면서도 전문적인 톤 유지
5. 기술적인 세부사항은 적절히 간소화`;

      const userContent = `
원본 요청: "${message}"
분석된 의도: ${JSON.stringify(intent)}
작업 결과: ${JSON.stringify(results)}

위 정보를 바탕으로 사용자에게 친근하고 이해하기 쉬운 응답을 생성해주세요.`;

      const response = await this.client.post('/api/v1/llm/chat', {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-3.5-turbo'
      });

      const duration = Date.now() - startTime;
      const content = response.data.choices[0].message.content.trim();
      
      logger.info(`✅ LLM 응답 생성 완료 (${duration}ms): "${content.substring(0, 100)}..."`);
      return content;

    } catch (error) {
      logger.error('❌ LLM 응답 생성 실패:', error);
      
      // 폴백 응답 생성
      return this.generateFallbackResponse(message, results, intent);
    }
  }

  // 에러 상황 응답 생성
  async generateErrorResponse(message, error) {
    try {
      const startTime = Date.now();
      logger.info(`⚠️ LLM 에러 응답 생성 시작`);

      const response = await this.client.post('/api/v1/llm/chat', {
        messages: [
          {
            role: 'system',
            content: `당신은 친근한 인프라 자동화 어시스턴트입니다. 
사용자의 요청을 처리하는 중에 발생한 문제를 친근하고 이해하기 쉽게 설명하세요.
사용자를 안심시키고 가능한 해결방법이나 대안을 제시하세요.`
          },
          {
            role: 'user',
            content: `사용자 요청: "${message}"
발생한 오류: ${error.message || error}

이 상황을 사용자에게 친근하게 설명하고 가능한 해결방법을 제시해주세요.`
          }
        ],
        temperature: 0.7,
        maxTokens: 300,
        model: 'gpt-3.5-turbo'
      });

      const duration = Date.now() - startTime;
      const content = response.data.choices[0].message.content.trim();
      
      logger.info(`✅ LLM 에러 응답 생성 완료 (${duration}ms)`);
      return content;

    } catch (llmError) {
      logger.error('❌ LLM 에러 응답 생성 실패:', llmError);
      
      // 최종 폴백 에러 응답
      return `죄송합니다. "${message}" 요청을 처리하는 중에 문제가 발생했습니다. 잠시 후 다시 시도해주시거나 관리자에게 문의해주세요.`;
    }
  }

  // 폴백 응답 생성 (LLM 호출 실패시)
  generateFallbackResponse(message, results, intent) {
    const intentType = intent?.intent || 'unknown';
    
    logger.info(`🔄 폴백 응답 생성 for intent: ${intentType}`);
    
    const fallbackTemplates = {
      monitor_servers: '서버 상태 확인 작업이 완료되었습니다.',
      monitor_and_restart: '서버 모니터링 및 재시작 작업이 처리되었습니다.',
      restart_service: '서비스 재시작 작업이 완료되었습니다.',
      backup_data: '데이터 백업 작업이 처리되었습니다.',
      deploy_service: '서비스 배포 작업이 진행되었습니다.',
      general_inquiry: '요청이 처리되었습니다.',
      unknown: `"${message}" 요청이 처리되었습니다.`
    };

    let response = fallbackTemplates[intentType] || fallbackTemplates.unknown;
    
    // 결과가 있으면 간단히 추가
    if (results && Array.isArray(results) && results.length > 0) {
      response += ` ${results.length}개의 작업이 실행되었습니다.`;
    }
    
    return response;
  }

  // 키워드 기반 폴백 의도 분석
  fallbackIntentAnalysis(message) {
    const lowerMessage = message.toLowerCase();
    
    logger.info(`🔄 폴백 의도 분석 사용: "${message}"`);
    
    // CPU 모니터링 및 재시작 패턴
    if ((lowerMessage.includes('cpu') || lowerMessage.includes('사용률')) && 
        (lowerMessage.includes('재시작') || lowerMessage.includes('restart'))) {
      return {
        intent: 'monitor_and_restart',
        action: 'monitor_and_restart',
        target: 'web_servers',
        entities: {
          metric: 'cpu',
          threshold: 90,
          service: 'nginx'
        },
        confidence: 0.8,
        category: 'infrastructure'
      };
    }
    
    // 서버 모니터링 패턴
    if (lowerMessage.includes('확인') || lowerMessage.includes('모니터링') || 
        lowerMessage.includes('상태') || lowerMessage.includes('status')) {
      return {
        intent: 'monitor_servers',
        action: 'monitor',
        target: 'web_servers',
        entities: {
          metric: 'status'
        },
        confidence: 0.7,
        category: 'infrastructure'
      };
    }
    
    // 재시작 패턴
    if (lowerMessage.includes('재시작') || lowerMessage.includes('restart')) {
      return {
        intent: 'restart_service',
        action: 'restart',
        target: 'web_servers',
        entities: {
          service: 'nginx'
        },
        confidence: 0.7,
        category: 'infrastructure'
      };
    }
    
    // 백업 패턴
    if (lowerMessage.includes('백업') || lowerMessage.includes('backup')) {
      return {
        intent: 'backup_data',
        action: 'backup',
        target: 'all_servers',
        entities: {},
        confidence: 0.7,
        category: 'infrastructure'
      };
    }
    
    // 기본 대화 패턴
    return {
      intent: 'general_inquiry',
      action: 'respond',
      target: 'system',
      entities: { original_message: message },
      confidence: 0.5,
      category: 'general'
    };
  }

  // 결과 요약 생성
  async generateSummary(executionResult, workflowName) {
    try {
      const response = await this.client.post('/api/v1/llm/chat', {
        messages: [
          {
            role: 'system',
            content: '워크플로우 실행 결과를 사용자에게 친근하고 이해하기 쉽게 요약해주세요.'
          },
          {
            role: 'user',
            content: `워크플로우 "${workflowName}" 실행이 완료되었습니다. 결과: ${JSON.stringify(executionResult)}`
          }
        ],
        temperature: 0.7,
        maxTokens: 300
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('❌ LLM 요약 생성 실패:', error);
      return `워크플로우 "${workflowName}" 실행이 완료되었습니다.`;
    }
  }
}

class MCPServiceClient extends ServiceClient {
  constructor() {
    super(config.SERVICES.MCP, 'MCP Service');
  }

  // MCP 도구 실행
  async executeTool(serverId, tool, params, async = true) {
    try {
      const response = await this.client.post('/api/v1/mcp/execute', {
        serverId,
        tool,
        params,
        async
      });

      return response.data;
    } catch (error) {
      logger.error(`❌ MCP 도구 실행 실패: ${tool}`, error);
      throw error;
    }
  }

  // MCP 실행 상태 조회
  async getExecutionStatus(executionId) {
    try {
      const response = await this.client.get(`/api/v1/mcp/executions/${executionId}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ MCP 실행 상태 조회 실패: ${executionId}`, error);
      throw error;
    }
  }

  // 사용 가능한 MCP 서버 목록
  async getServers() {
    try {
      const response = await this.client.get('/api/v1/mcp/servers');
      return response.data;
    } catch (error) {
      logger.error('❌ MCP 서버 목록 조회 실패:', error);
      throw error;
    }
  }

  // 서버별 도구 목록
  async getServerTools(serverId) {
    try {
      const response = await this.client.get(`/api/v1/mcp/servers/${serverId}/tools`);
      return response.data;
    } catch (error) {
      logger.error(`❌ MCP 서버 도구 목록 조회 실패: ${serverId}`, error);
      throw error;
    }
  }
}

class DeviceServiceClient extends ServiceClient {
  constructor() {
    super(config.SERVICES.DEVICE, 'Device Service');
  }

  // 장비 목록 조회
  async getDevices(filters = {}) {
    try {
      const response = await this.client.get('/api/v1/devices', { params: filters });
      return response.data;
    } catch (error) {
      logger.error('❌ 장비 목록 조회 실패:', error);
      throw error;
    }
  }

  // 특정 장비 상태 조회
  async getDeviceStatus(deviceId) {
    try {
      const response = await this.client.get(`/api/v1/devices/${deviceId}/status`);
      return response.data;
    } catch (error) {
      logger.error(`❌ 장비 상태 조회 실패: ${deviceId}`, error);
      throw error;
    }
  }

  // 장비 메트릭 조회
  async getDeviceMetrics(deviceId, metric = null, timeRange = {}) {
    try {
      const params = { ...timeRange };
      if (metric) params.metric = metric;

      const response = await this.client.get(`/api/v1/devices/${deviceId}/metrics`, { params });
      return response.data;
    } catch (error) {
      logger.error(`❌ 장비 메트릭 조회 실패: ${deviceId}`, error);
      throw error;
    }
  }

  // 그룹별 장비 조회
  async getDevicesByGroup(groupName) {
    try {
      const response = await this.client.get('/api/v1/devices', {
        params: { groupName }
      });
      return response.data;
    } catch (error) {
      logger.error(`❌ 그룹별 장비 조회 실패: ${groupName}`, error);
      throw error;
    }
  }
}

// 클라이언트 인스턴스들
const llmClient = new LLMServiceClient();
const mcpClient = new MCPServiceClient();
const deviceClient = new DeviceServiceClient();

module.exports = {
  LLMServiceClient,
  MCPServiceClient,
  DeviceServiceClient,
  llmClient,
  mcpClient,
  deviceClient
};
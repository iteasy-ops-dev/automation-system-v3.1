// 🏗️ 워크플로우 템플릿 정의 - TASK-WF-004 구현
// 완전한 엔드투엔드 오케스트레이션 시스템

const logger = require('../utils/logger');

/**
 * 고급 워크플로우 템플릿 정의
 * 각 템플릿은 의도 패턴, 실행 단계, 병렬 처리, 에러 복구 전략을 포함
 */
const workflowTemplates = {
  server_status_comprehensive: {
    name: 'Comprehensive Server Status Check',
    description: '포괄적인 서버 상태 확인 워크플로우',
    intent_patterns: [
      /서버.*상태.*확인/,
      /서버.*체크/,
      /server.*status.*check/i,
      /check.*server.*status/i,
      /모든.*서버/,
      /시스템.*상태/
    ],
    steps: [
      {
        id: 'connectivity_check',
        type: 'mcp_tool_execution',
        name: 'Network Connectivity Check',
        tool: 'start_process',
        parameters: { 
          command: 'docker ps --format "table {{.Names}}\\t{{.Status}}" | grep automation',
          timeout_ms: 10000 
        },
        parallel_group: 'connectivity',
        critical: false
      },
      {
        id: 'process_check',
        type: 'mcp_tool_execution', 
        name: 'System Process Check',
        tool: 'list_processes',
        parameters: {},
        parallel_group: 'connectivity',
        critical: false
      },
      {
        id: 'device_status_check',
        type: 'device_status_check',
        name: 'Device Status Collection',
        includeMetrics: true,
        timeRange: '10m',
        critical: true
      },
      {
        id: 'health_evaluation',
        type: 'conditional_check',
        name: 'Overall Health Evaluation',
        condition: 'connectivity.success && devices.active > 0',
        onTrue: { action: 'mark_healthy' },
        onFalse: { action: 'flag_for_attention' }
      },
      {
        id: 'generate_summary',
        type: 'llm_processing',
        name: 'Generate Status Summary',
        task: 'summarize_server_health',
        template: 'server_status_summary'
      }
    ],
    parallel_execution: {
      groups: {
        connectivity: { max_concurrent: 5, timeout: 15000 }
      }
    },
    error_handling: {
      critical_steps: ['device_status_check'],
      retry_policy: { max_attempts: 3, backoff: 'exponential' },
      fallback_strategy: 'partial_results'
    },
    timeout_ms: 60000
  },

  high_cpu_server_restart: {
    name: 'High CPU Server Restart Workflow',
    description: 'CPU 사용률 높은 서버 식별 및 재시작',
    intent_patterns: [
      /CPU.*90.*재시작/,
      /CPU.*높은.*서버.*재시작/,
      /restart.*high.*cpu/i,
      /고부하.*서버.*재시작/,
      /재시작.*CPU/
    ],
    steps: [
      {
        id: 'identify_high_cpu',
        type: 'device_status_check',
        name: 'Identify High CPU Servers',
        condition: 'cpu_usage > 90',
        includeMetrics: true,
        timeRange: '5m',
        critical: true
      },
      {
        id: 'confirm_restart_needed',
        type: 'conditional_check',
        name: 'Confirm Restart Needed',
        condition: 'count(high_cpu_servers) > 0',
        onFalse: { action: 'report_no_action_needed' }
      },
      {
        id: 'user_confirmation',
        type: 'user_confirmation',
        name: 'Request User Confirmation',
        message: '다음 서버들의 CPU 사용률이 높습니다. 재시작하시겠습니까?',
        require_approval: true,
        timeout_seconds: 300
      },
      {
        id: 'graceful_service_stop',
        type: 'mcp_tool_execution',
        name: 'Graceful Service Stop',
        tool: 'start_process',
        parameters: { 
          command: 'docker-compose stop --timeout 30',
          timeout_ms: 35000
        },
        forEach: 'high_cpu_servers',
        sequential: true
      },
      {
        id: 'verify_restart_success',
        type: 'device_status_check',
        name: 'Verify Restart Success',
        wait_condition: 'system_up_time < 300',
        timeout_ms: 120000
      },
      {
        id: 'generate_restart_report',
        type: 'llm_processing',
        name: 'Generate Restart Report',
        task: 'summarize_restart_results',
        template: 'server_restart_report'
      }
    ],
    confirmations: [
      {
        step: 'graceful_service_stop',
        message: '다음 서버들을 재시작하시겠습니까?',
        require_approval: true
      }
    ],
    timeout_ms: 600000 // 10분
  },

  system_health_monitoring: {
    name: 'Continuous System Health Monitoring',
    description: '지속적인 시스템 상태 모니터링',
    intent_patterns: [
      /시스템.*모니터링/,
      /상태.*모니터링/,
      /health.*monitoring/i,
      /지속.*모니터링/
    ],
    steps: [
      {
        id: 'docker_health_check',
        type: 'mcp_tool_execution',
        name: 'Docker Health Check',
        tool: 'start_process',
        parameters: { 
          command: 'docker stats --no-stream --format "table {{.Container}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"',
          timeout_ms: 15000 
        },
        critical: true
      },
      {
        id: 'disk_usage_check',
        type: 'mcp_tool_execution',
        name: 'Disk Usage Check',
        tool: 'start_process',
        parameters: { 
          command: 'df -h | head -10',
          timeout_ms: 10000 
        },
        critical: false
      },
      {
        id: 'memory_usage_check',
        type: 'mcp_tool_execution',
        name: 'Memory Usage Check',
        tool: 'start_process',
        parameters: { 
          command: 'free -h',
          timeout_ms: 5000 
        },
        critical: false
      },
      {
        id: 'analyze_health_metrics',
        type: 'llm_processing',
        name: 'Analyze Health Metrics',
        task: 'analyze_system_health',
        template: 'health_analysis_summary'
      }
    ],
    parallel_execution: {
      groups: {
        system_checks: { max_concurrent: 3, timeout: 20000 }
      }
    },
    timeout_ms: 45000
  }
};

/**
 * 의도에 따라 워크플로우 템플릿 선택
 * @param {Object} intent LLM이 분석한 사용자 의도
 * @returns {Object|null} 매칭된 워크플로우 템플릿
 */
function selectWorkflowTemplate(intent) {
  logger.info(`🔍 워크플로우 템플릿 선택 중: "${intent.intent}" | 원문: "${intent.original_message}"`);
  
  let bestMatch = null;
  let highestConfidence = 0;
  
  for (const [templateId, template] of Object.entries(workflowTemplates)) {
    const confidence = calculateMatchConfidence(intent, template);
    
    logger.debug(`📊 템플릿 "${template.name}" 신뢰도: ${confidence.toFixed(3)}`);
    
    if (confidence > highestConfidence && confidence > 0.3) {
      highestConfidence = confidence;
      bestMatch = {
        id: templateId,
        ...template,
        confidence,
        matched_intent: intent.intent
      };
    }
  }
  
  if (bestMatch) {
    logger.info(`✅ 템플릿 선택됨: "${bestMatch.name}" (신뢰도: ${bestMatch.confidence.toFixed(3)})`);
  } else {
    logger.warn(`❌ 적절한 워크플로우 템플릿을 찾을 수 없음`);
  }
  
  return bestMatch;
}

/**
 * 의도와 템플릿 간의 매칭 신뢰도 계산
 * @param {Object} intent 사용자 의도
 * @param {Object} template 워크플로우 템플릿
 * @returns {number} 0-1 사이의 신뢰도 점수
 */
function calculateMatchConfidence(intent, template) {
  let confidence = 0;
  
  const originalMessage = intent.original_message.toLowerCase();
  
  // 1. 패턴 매칭 점수 (40%)
  const patternMatches = template.intent_patterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(originalMessage);
    } else {
      return originalMessage.includes(pattern.toLowerCase());
    }
  });
  
  if (patternMatches) {
    confidence += 0.4;
  }
  
  // 2. 키워드 매칭 점수 (30%)
  const templateKeywords = template.name.toLowerCase().split(/\W+/);
  const intentKeywords = intent.intent.toLowerCase().split(/\W+/);
  const messageKeywords = originalMessage.split(/\W+/);
  
  const allKeywords = [...intentKeywords, ...messageKeywords];
  const keywordMatches = templateKeywords.filter(keyword => 
    allKeywords.some(word => word.includes(keyword) || keyword.includes(word))
  );
  
  if (templateKeywords.length > 0) {
    confidence += (keywordMatches.length / templateKeywords.length) * 0.3;
  }
  
  // 3. 의도 카테고리 매칭 (30%)
  const intentCategoryMap = {
    'monitor_servers': ['status', 'monitoring', 'health'],
    'monitor_and_restart': ['restart', 'high_cpu'],
    'restart_service': ['restart', 'reboot'],
    'backup_data': ['backup', 'data'],
    'system_analysis': ['analysis', 'check']
  };
  
  const intentCategory = intentCategoryMap[intent.intent] || [];
  const categoryMatches = intentCategory.some(category => 
    template.name.toLowerCase().includes(category)
  );
  
  if (categoryMatches) {
    confidence += 0.3;
  }
  
  // 최대 1.0으로 제한
  return Math.min(confidence, 1.0);
}

/**
 * 기본 워크플로우 템플릿 반환 (매칭 실패시)
 * @returns {Object} 기본 서버 상태 확인 템플릿
 */
function getDefaultTemplate() {
  logger.info(`📋 기본 템플릿 사용: server_status_comprehensive`);
  
  return {
    id: 'server_status_comprehensive',
    ...workflowTemplates.server_status_comprehensive,
    confidence: 0.2,
    matched_intent: 'default'
  };
}

/**
 * 실행 계획 생성
 * @param {Object} intent 사용자 의도
 * @param {Object} template 선택된 워크플로우 템플릿
 * @returns {Object} 실행 계획
 */
function createExecutionPlan(intent, template) {
  logger.info(`📋 실행 계획 생성: ${template.name}`);
  
  const plan = {
    templateId: template.id,
    templateName: template.name,
    steps: template.steps,
    parallel: !!template.parallel_execution,
    parallelGroups: template.parallel_execution?.groups || {},
    timeout: template.timeout_ms || 60000,
    errorHandling: template.error_handling || {},
    confirmations: template.confirmations || [],
    estimatedDuration: estimateExecutionDuration(template),
    createdAt: new Date()
  };
  
  logger.info(`✅ 실행 계획 생성 완료: ${plan.steps.length}개 단계, 예상 소요시간: ${plan.estimatedDuration}ms`);
  
  return plan;
}

/**
 * 실행 예상 시간 계산
 * @param {Object} template 워크플로우 템플릿
 * @returns {number} 예상 실행 시간 (밀리초)
 */
function estimateExecutionDuration(template) {
  let totalTime = 0;
  
  for (const step of template.steps) {
    if (step.parameters?.timeout_ms) {
      totalTime += step.parameters.timeout_ms;
    } else {
      // 기본 예상 시간
      switch (step.type) {
        case 'mcp_tool_execution':
          totalTime += 10000; // 10초
          break;
        case 'device_status_check':
          totalTime += 15000; // 15초
          break;
        case 'llm_processing':
          totalTime += 5000; // 5초
          break;
        default:
          totalTime += 3000; // 3초
      }
    }
  }
  
  // 병렬 처리 고려
  if (template.parallel_execution) {
    totalTime *= 0.6; // 40% 시간 단축 예상
  }
  
  return totalTime;
}

module.exports = {
  workflowTemplates,
  selectWorkflowTemplate,
  getDefaultTemplate,
  createExecutionPlan,
  calculateMatchConfidence
};

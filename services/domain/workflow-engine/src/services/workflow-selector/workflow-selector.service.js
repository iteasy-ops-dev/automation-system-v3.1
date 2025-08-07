/**
 * 🎯 Workflow Selector Service - LLM 기반 워크플로우 선택
 * 
 * 목적: 동적 워크플로우 생성 대신 기존 활성화된 워크플로우 선택
 * 방식: LLM이 사용자 의도를 분석하여 적절한 기존 워크플로우 선택
 */

const logger = require('../../utils/logger');
const n8nEngineService = require('../n8n-engine.service');
const { llmClient } = require('../external.service');

class WorkflowSelectorService {
    constructor() {
        this.name = 'WorkflowSelectorService';
        this.version = '1.0.0';
        
        // 기존 워크플로우 캐시
        this.workflowCache = new Map();
        this.lastCacheUpdate = null;
        this.cacheValidityMinutes = 5; // 5분간 캐시 유지
        
        logger.info(`✅ ${this.name} v${this.version} 초기화 완료`);
    }

    /**
     * 🧠 LLM 기반 워크플로우 선택 (핵심 메서드)
     */
    async selectWorkflowForIntent(intent, context = {}) {
        logger.info(`🧠 워크플로우 선택 시작: ${intent.intent || intent}`);

        try {
            // 1. 활성화된 워크플로우 목록 조회
            const availableWorkflows = await this.getAvailableWorkflows();
            
            if (availableWorkflows.length === 0) {
                logger.warn(`⚠️ 활성화된 워크플로우가 없습니다`);
                return null;
            }

            logger.info(`📋 활성화된 워크플로우 ${availableWorkflows.length}개 발견`);

            // 2. LLM을 통한 워크플로우 선택
            const selectedWorkflow = await this.selectWithLLM(intent, availableWorkflows, context);
            
            if (!selectedWorkflow) {
                logger.warn(`⚠️ 의도에 맞는 워크플로우를 찾을 수 없습니다: ${intent.intent || intent}`);
                return null;
            }

            logger.info(`✅ 워크플로우 선택 완료: ${selectedWorkflow.name} (ID: ${selectedWorkflow.id})`);
            
            return selectedWorkflow;

        } catch (error) {
            logger.error(`❌ 워크플로우 선택 실패:`, error);
            
            // 폴백: 기본 워크플로우 선택
            return await this.selectFallbackWorkflow(intent);
        }
    }

    /**
     * 📋 활성화된 워크플로우 목록 조회 (캐시 사용)
     */
    async getAvailableWorkflows() {
        try {
            // 캐시 유효성 확인
            const now = new Date();
            const cacheAge = this.lastCacheUpdate ? 
                (now - this.lastCacheUpdate) / (1000 * 60) : Infinity;

            if (cacheAge < this.cacheValidityMinutes && this.workflowCache.size > 0) {
                logger.debug(`📋 캐시된 워크플로우 사용: ${this.workflowCache.size}개`);
                return Array.from(this.workflowCache.values());
            }

            // n8n에서 활성화된 워크플로우 목록 조회
            logger.info(`🔄 n8n에서 활성화된 워크플로우 목록 조회 중...`);
            const activeWorkflows = await n8nEngineService.getActiveWorkflows();
            
            // 캐시 업데이트
            this.workflowCache.clear();
            activeWorkflows.forEach(workflow => {
                this.workflowCache.set(workflow.id, {
                    id: workflow.id,
                    name: workflow.name,
                    active: workflow.active,
                    nodes: workflow.nodes || [],
                    tags: workflow.tags || [],
                    description: this.extractWorkflowDescription(workflow),
                    capabilities: this.analyzeWorkflowCapabilities(workflow),
                    lastModified: workflow.updatedAt,
                    createdAt: workflow.createdAt
                });
            });
            
            this.lastCacheUpdate = now;
            
            logger.info(`✅ 워크플로우 캐시 업데이트: ${activeWorkflows.length}개 활성 워크플로우`);
            
            return activeWorkflows;

        } catch (error) {
            logger.error(`❌ 워크플로우 목록 조회 실패:`, error);
            
            // 캐시가 있으면 캐시 반환
            if (this.workflowCache.size > 0) {
                logger.warn(`⚠️ 캐시된 워크플로우 사용 (오류 발생)`);
                return Array.from(this.workflowCache.values());
            }
            
            return [];
        }
    }

    /**
     * 🤖 LLM을 통한 워크플로우 선택
     */
    async selectWithLLM(intent, availableWorkflows, context) {
        try {
            logger.info(`🤖 LLM 워크플로우 선택 시작: ${availableWorkflows.length}개 후보`);

            // 워크플로우 요약 정보 생성
            const workflowSummaries = availableWorkflows.map(workflow => ({
                id: workflow.id,
                name: workflow.name,
                description: workflow.description || this.extractWorkflowDescription(workflow),
                capabilities: workflow.capabilities || this.analyzeWorkflowCapabilities(workflow),
                nodeCount: workflow.nodes?.length || 0,
                tags: workflow.tags || []
            }));

            // LLM 프롬프트 구성
            const selectionPrompt = this.buildWorkflowSelectionPrompt(intent, workflowSummaries, context);
            
            logger.debug(`📝 LLM 프롬프트 생성 완료 (${selectionPrompt.length} 문자)`);

            // LLM 호출 (임시로 비활성화하고 규칙 기반으로 직접 이동)
            logger.warn(`⚠️ LLM 워크플로우 선택 임시 비활성화, 규칙 기반 사용`);
            return await this.selectWithRules(intent, availableWorkflows, context);

            // TODO: LLM 호출 재활성화 필요
            /*
            const llmResponse = await llmClient.analyzeWorkflowSelection({
                intent: intent,
                workflows: workflowSummaries,
                prompt: selectionPrompt,
                context: context
            });

            logger.info(`🤖 LLM 응답 수신:`, {
                selectedWorkflowId: llmResponse.selectedWorkflowId,
                confidence: llmResponse.confidence,
                reasoning: llmResponse.reasoning?.substring(0, 100) + '...'
            });

            // LLM 응답 검증
            if (!llmResponse.selectedWorkflowId) {
                logger.warn(`⚠️ LLM이 워크플로우를 선택하지 않음`);
                return null;
            }

            // 선택된 워크플로우 반환
            const selectedWorkflow = availableWorkflows.find(w => w.id === llmResponse.selectedWorkflowId);
            
            if (!selectedWorkflow) {
                logger.error(`❌ LLM이 선택한 워크플로우를 찾을 수 없음: ${llmResponse.selectedWorkflowId}`);
                return null;
            }

            // 선택 메타데이터 추가
            selectedWorkflow.selectionMetadata = {
                confidence: llmResponse.confidence,
                reasoning: llmResponse.reasoning,
                selectedBy: 'llm',
                selectedAt: new Date(),
                intent: intent
            };

            return selectedWorkflow;
            */

        } catch (llmError) {
            logger.error(`❌ LLM 워크플로우 선택 실패:`, llmError);
            
            // 폴백: 규칙 기반 선택
            return await this.selectWithRules(intent, availableWorkflows, context);
        }
    }

    /**
     * 📝 워크플로우 선택 프롬프트 생성
     */
    buildWorkflowSelectionPrompt(intent, workflows, context) {
        const intentText = typeof intent === 'string' ? intent : intent.intent;
        const originalMessage = intent.original_message || context.originalMessage || intentText;
        const entities = intent.entities || {};

        return `당신은 IT 자동화 시스템의 워크플로우 선택 전문가입니다.

사용자 요청: "${originalMessage}"
분석된 의도: ${intentText}
추출된 엔티티: ${JSON.stringify(entities, null, 2)}

다음 활성화된 워크플로우 중에서 사용자 요청에 가장 적합한 것을 선택해주세요:

${workflows.map((workflow, index) => `
${index + 1}. **${workflow.name}** (ID: ${workflow.id})
   - 설명: ${workflow.description}
   - 기능: ${workflow.capabilities.join(', ')}
   - 노드 수: ${workflow.nodeCount}개
   - 태그: ${workflow.tags.join(', ') || '없음'}
`).join('\n')}

선택 기준:
1. 사용자 의도와의 정확한 매칭
2. 워크플로우의 기능과 사용자 요구사항의 일치도
3. 워크플로우의 복잡도와 작업 범위의 적절성
4. 예상 성공률과 안정성

응답 형식 (JSON):
{
  "selectedWorkflowId": "선택한 워크플로우 ID",
  "confidence": 0.95,
  "reasoning": "선택 이유에 대한 상세한 설명",
  "alternativeOptions": ["대안 워크플로우 ID들"],
  "expectedOutcome": "예상 실행 결과"
}

만약 적절한 워크플로우가 없다면:
{
  "selectedWorkflowId": null,
  "confidence": 0.0,
  "reasoning": "적절한 워크플로우가 없는 이유",
  "suggestedAction": "대안 제안"
}`;
    }

    /**
     * 📏 규칙 기반 워크플로우 선택 (LLM 폴백)
     */
    async selectWithRules(intent, availableWorkflows, context) {
        logger.info(`📏 규칙 기반 워크플로우 선택 시작`);

        try {
            const intentText = typeof intent === 'string' ? intent : intent.intent;
            const originalMessage = intent.original_message || context.originalMessage || intentText;
            
            // 키워드 기반 점수 계산
            const scoredWorkflows = availableWorkflows.map(workflow => {
                const score = this.calculateWorkflowScore(originalMessage, workflow);
                return { workflow, score };
            });

            // 점수 순으로 정렬
            scoredWorkflows.sort((a, b) => b.score - a.score);

            if (scoredWorkflows.length === 0 || scoredWorkflows[0].score === 0) {
                logger.warn(`⚠️ 규칙 기반 선택에서도 적절한 워크플로우를 찾지 못함`);
                return null;
            }

            const selectedWorkflow = scoredWorkflows[0].workflow;
            selectedWorkflow.selectionMetadata = {
                confidence: Math.min(scoredWorkflows[0].score / 10, 1.0), // 0-1 범위로 정규화
                reasoning: `규칙 기반 선택: 키워드 매칭 점수 ${scoredWorkflows[0].score}`,
                selectedBy: 'rules',
                selectedAt: new Date(),
                intent: intent,
                allScores: scoredWorkflows.map(s => ({ 
                    name: s.workflow.name, 
                    score: s.score 
                }))
            };

            logger.info(`✅ 규칙 기반 선택 완료: ${selectedWorkflow.name} (점수: ${scoredWorkflows[0].score})`);

            return selectedWorkflow;

        } catch (error) {
            logger.error(`❌ 규칙 기반 워크플로우 선택 실패:`, error);
            return null;
        }
    }

    /**
     * 🔢 워크플로우 점수 계산 (키워드 매칭)
     */
    calculateWorkflowScore(message, workflow) {
        const lowerMessage = message.toLowerCase();
        let score = 0;

        logger.debug(`🔢 워크플로우 점수 계산: "${workflow.name}" vs "${message}"`);

        // 워크플로우 이름 매칭 (높은 점수)
        const workflowNameLower = workflow.name.toLowerCase();
        if (workflowNameLower.includes('server') && lowerMessage.includes('서버')) score += 10;
        if (workflowNameLower.includes('status') && (lowerMessage.includes('상태') || lowerMessage.includes('확인'))) score += 10;
        if (workflowNameLower.includes('check') && (lowerMessage.includes('체크') || lowerMessage.includes('확인'))) score += 10;
        if (workflowNameLower.includes('comprehensive') && (lowerMessage.includes('모든') || lowerMessage.includes('전체'))) score += 8;
        if (workflowNameLower.includes('monitor') && lowerMessage.includes('모니터링')) score += 8;
        if (workflowNameLower.includes('restart') && lowerMessage.includes('재시작')) score += 8;
        if (workflowNameLower.includes('cpu') && lowerMessage.includes('cpu')) score += 6;

        // 기능(capabilities) 매칭
        const capabilities = workflow.capabilities || [];
        capabilities.forEach(capability => {
            const capabilityLower = capability.toLowerCase();
            if (capabilityLower.includes('process') && lowerMessage.includes('프로세스')) score += 5;
            if (capabilityLower.includes('docker') && lowerMessage.includes('docker')) score += 5;
            if (capabilityLower.includes('system') && lowerMessage.includes('시스템')) score += 5;
            if (capabilityLower.includes('monitoring') && lowerMessage.includes('모니터링')) score += 5;
            if (capabilityLower.includes('server_management') && lowerMessage.includes('서버')) score += 4;
            if (capabilityLower.includes('status_monitoring') && lowerMessage.includes('상태')) score += 4;
        });

        // 설명 매칭
        const description = workflow.description || '';
        const descriptionLower = description.toLowerCase();
        if (descriptionLower.includes('server') && lowerMessage.includes('서버')) score += 3;
        if (descriptionLower.includes('status') && lowerMessage.includes('상태')) score += 3;
        if (descriptionLower.includes('comprehensive') && lowerMessage.includes('모든')) score += 3;

        // 태그 매칭
        const tags = workflow.tags || [];
        tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            if (lowerMessage.includes(tagLower)) score += 6;
        });

        // 노드 복잡도 보너스 (복잡한 워크플로우는 더 많은 기능 제공)
        const nodeCount = workflow.nodes?.length || 0;
        if (nodeCount > 5) score += 2;
        if (nodeCount > 8) score += 2;

        // 특별 매칭: "Comprehensive Server Status Check"는 서버 상태 확인에 최적
        if (workflowNameLower.includes('comprehensive') && 
            workflowNameLower.includes('server') && 
            workflowNameLower.includes('status') &&
            (lowerMessage.includes('서버') && lowerMessage.includes('상태'))) {
            score += 15; // 보너스 점수
        }

        logger.debug(`📊 워크플로우 "${workflow.name}" 최종 점수: ${score}`);
        return score;
    }

    /**
     * 🔧 워크플로우 설명 추출
     */
    extractWorkflowDescription(workflow) {
        // 워크플로우 이름에서 설명 추출
        if (workflow.name) {
            if (workflow.name.toLowerCase().includes('server') && workflow.name.toLowerCase().includes('status')) {
                return '서버 상태 확인 및 모니터링을 수행하는 워크플로우';
            }
            if (workflow.name.toLowerCase().includes('comprehensive')) {
                return '종합적인 시스템 진단 및 상태 확인을 수행하는 워크플로우';
            }
        }

        // 노드 구성에서 설명 추출
        const nodes = workflow.nodes || [];
        const nodeTypes = nodes.map(node => node.type).filter(Boolean);
        
        let description = '다음 기능들을 수행하는 워크플로우: ';
        const features = [];
        
        if (nodeTypes.includes('n8n-nodes-base.webhook')) features.push('웹훅 트리거');
        if (nodeTypes.includes('n8n-nodes-base.httpRequest')) features.push('HTTP 요청');
        if (nodeTypes.includes('n8n-nodes-base.function')) features.push('데이터 처리');
        
        return description + features.join(', ');
    }

    /**
     * 🔍 워크플로우 기능 분석
     */
    analyzeWorkflowCapabilities(workflow) {
        const capabilities = [];
        const nodes = workflow.nodes || [];

        // 노드 타입 기반 기능 분석
        nodes.forEach(node => {
            switch (node.type) {
                case 'n8n-nodes-base.webhook':
                    capabilities.push('webhook_trigger');
                    break;
                case 'n8n-nodes-base.httpRequest':
                    capabilities.push('http_requests');
                    if (node.parameters?.url?.includes('mcp')) {
                        capabilities.push('mcp_integration');
                    }
                    break;
                case 'n8n-nodes-base.function':
                    capabilities.push('data_processing');
                    break;
                case 'n8n-nodes-base.set':
                    capabilities.push('data_transformation');
                    break;
                default:
                    if (node.type) {
                        capabilities.push(`custom_${node.type.split('.').pop()}`);
                    }
            }
        });

        // 워크플로우 이름 기반 기능 추론
        const workflowName = workflow.name?.toLowerCase() || '';
        if (workflowName.includes('server')) capabilities.push('server_management');
        if (workflowName.includes('status')) capabilities.push('status_monitoring');
        if (workflowName.includes('monitor')) capabilities.push('system_monitoring');
        if (workflowName.includes('check')) capabilities.push('health_checks');
        if (workflowName.includes('restart')) capabilities.push('service_restart');
        if (workflowName.includes('backup')) capabilities.push('backup_operations');

        return [...new Set(capabilities)]; // 중복 제거
    }

    /**
     * 🔄 폴백 워크플로우 선택
     */
    async selectFallbackWorkflow(intent) {
        logger.info(`🔄 폴백 워크플로우 선택 시작`);

        try {
            const availableWorkflows = await this.getAvailableWorkflows();
            
            if (availableWorkflows.length === 0) {
                logger.warn(`⚠️ 폴백할 워크플로우가 없습니다`);
                return null;
            }

            // 가장 일반적인 워크플로우 선택 (노드 수가 많고 최근에 수정된 것)
            const fallbackWorkflow = availableWorkflows
                .sort((a, b) => {
                    const aNodeCount = a.nodes?.length || 0;
                    const bNodeCount = b.nodes?.length || 0;
                    const aDate = new Date(a.lastModified || a.createdAt || 0);
                    const bDate = new Date(b.lastModified || b.createdAt || 0);
                    
                    // 노드 수 우선, 그 다음 최신 수정일
                    if (aNodeCount !== bNodeCount) {
                        return bNodeCount - aNodeCount;
                    }
                    return bDate - aDate;
                })[0];

            fallbackWorkflow.selectionMetadata = {
                confidence: 0.3, // 낮은 신뢰도
                reasoning: '다른 선택 방법이 실패하여 기본 워크플로우를 선택함',
                selectedBy: 'fallback',
                selectedAt: new Date(),
                intent: intent
            };

            logger.info(`✅ 폴백 워크플로우 선택: ${fallbackWorkflow.name}`);

            return fallbackWorkflow;

        } catch (error) {
            logger.error(`❌ 폴백 워크플로우 선택 실패:`, error);
            return null;
        }
    }

    /**
     * 🗂️ 캐시 정리
     */
    clearCache() {
        this.workflowCache.clear();
        this.lastCacheUpdate = null;
        logger.info(`🗂️ 워크플로우 캐시 정리 완료`);
    }

    /**
     * 📊 선택 통계
     */
    getSelectionStats() {
        return {
            cacheSize: this.workflowCache.size,
            lastCacheUpdate: this.lastCacheUpdate,
            cacheValidityMinutes: this.cacheValidityMinutes,
            cachedWorkflows: Array.from(this.workflowCache.values()).map(w => ({
                id: w.id,
                name: w.name,
                capabilities: w.capabilities,
                nodeCount: w.nodes?.length || 0
            }))
        };
    }
}

// 싱글톤 인스턴스
const workflowSelectorService = new WorkflowSelectorService();

module.exports = workflowSelectorService;
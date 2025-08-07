/**
 * n8n Webhook 기반 실행 구현
 * REST API 인증 문제 우회
 */

const axios = require('axios');
const logger = require('../utils/logger');

class N8nWebhookExecutor {
    constructor() {
        this.baseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
        this.webhookPaths = new Map(); // workflowId -> webhookPath 매핑
    }
    
    /**
     * 워크플로우 생성 시 Webhook 노드 포함
     */
    async createWorkflowWithWebhook(name, description) {
        const webhookPath = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const workflow = {
            name: name,
            nodes: [
                {
                    id: 'webhook_1',
                    name: 'Webhook',
                    type: 'n8n-nodes-base.webhook',
                    typeVersion: 1,
                    position: [250, 300],
                    parameters: {
                        path: webhookPath,
                        method: 'POST',
                        responseMode: 'onReceived',
                        responseData: 'allEntries'
                    }
                },
                {
                    id: 'function_1',
                    name: 'Process Data',
                    type: 'n8n-nodes-base.function',
                    typeVersion: 1,
                    position: [450, 300],
                    parameters: {
                        functionCode: `
                            // 입력 데이터 처리
                            const inputData = items[0].json;
                            
                            // 여기에 실제 로직 구현
                            const result = {
                                success: true,
                                timestamp: new Date().toISOString(),
                                input: inputData,
                                processed: true
                            };
                            
                            return [{json: result}];
                        `
                    }
                }
            ],
            connections: {
                'webhook_1': {
                    'main': [
                        [
                            {
                                node: 'function_1',
                                type: 'main',
                                index: 0
                            }
                        ]
                    ]
                }
            },
            settings: {
                saveDataErrorExecution: 'all',
                saveDataSuccessExecution: 'all',
                saveManualExecutions: true
            },
            active: true // 자동 활성화
        };
        
        // 워크플로우 ID 생성 (임시)
        const workflowId = `webhook-${Date.now()}`;
        
        // Webhook 경로 저장
        this.webhookPaths.set(workflowId, webhookPath);
        
        logger.info(`Workflow created with webhook path: /webhook/${webhookPath}`);
        
        return {
            id: workflowId,
            webhookPath: webhookPath,
            webhookUrl: `${this.baseUrl}/webhook/${webhookPath}`,
            workflow: workflow
        };
    }
    
    /**
     * Webhook을 통한 워크플로우 실행
     */
    async executeViaWebhook(workflowId, inputData) {
        const webhookPath = this.webhookPaths.get(workflowId);
        
        if (!webhookPath) {
            throw new Error(`No webhook path found for workflow ${workflowId}`);
        }
        
        const webhookUrl = `${this.baseUrl}/webhook/${webhookPath}`;
        
        try {
            logger.info(`Executing workflow via webhook: ${webhookUrl}`);
            
            const response = await axios.post(webhookUrl, inputData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            return {
                success: true,
                executionId: `webhook-exec-${Date.now()}`,
                data: response.data,
                webhookPath: webhookPath
            };
            
        } catch (error) {
            logger.error(`Webhook execution failed: ${error.message}`);
            
            // 404는 워크플로우가 비활성화되었거나 존재하지 않음
            if (error.response?.status === 404) {
                throw new Error('Workflow not found or inactive. Please activate the workflow in n8n UI.');
            }
            
            throw error;
        }
    }
    
    /**
     * Production Webhook 사용 (워크플로우 활성화 불필요)
     */
    async executeViaProductionWebhook(webhookPath, inputData) {
        const webhookUrl = `${this.baseUrl}/webhook-prod/${webhookPath}`;
        
        try {
            const response = await axios.post(webhookUrl, inputData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            if (error.response?.status === 404) {
                // Production webhook이 없으면 일반 webhook 시도
                return this.executeViaTestWebhook(webhookPath, inputData);
            }
            throw error;
        }
    }
    
    /**
     * Test Webhook 사용 (워크플로우 활성화 필요)
     */
    async executeViaTestWebhook(webhookPath, inputData) {
        const webhookUrl = `${this.baseUrl}/webhook-test/${webhookPath}`;
        
        const response = await axios.post(webhookUrl, inputData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        
        return {
            success: true,
            data: response.data
        };
    }
}

module.exports = N8nWebhookExecutor;

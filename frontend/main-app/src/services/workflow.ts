/**
 * Workflow API Client
 * 
 * 완성된 TASK-12 Workflow Engine Service와 통신
 */

import type {
  ChatWorkflowRequest,
  ChatWorkflowResponse,
  WorkflowExecutionStatus,
} from '@/types';
import apiClient from './api';

class WorkflowApiClient {
  private readonly baseUrl = '/api/v1/workflows';

  /**
   * 채팅 메시지를 워크플로우로 실행
   */
  async executeChatWorkflow(request: ChatWorkflowRequest): Promise<ChatWorkflowResponse> {
    this.validateChatRequest(request);
    return apiClient.post(`${this.baseUrl}/chat`, request);
  }

  /**
   * 워크플로우 실행 상태 조회
   */
  async getExecutionStatus(executionId: string): Promise<WorkflowExecutionStatus> {
    return apiClient.get(`${this.baseUrl}/executions/${executionId}?includeSteps=true`);
  }

  /**
   * 워크플로우 실행 취소
   */
  async cancelExecution(executionId: string): Promise<void> {
    return apiClient.delete(`${this.baseUrl}/executions/${executionId}`);
  }

  private validateChatRequest(request: ChatWorkflowRequest): void {
    if (!request.sessionId || !request.message) {
      throw new Error('SessionId and message are required');
    }
    if (request.message.length > 2000) {
      throw new Error('Message too long (max 2000 characters)');
    }
  }
}

export const workflowApi = new WorkflowApiClient();

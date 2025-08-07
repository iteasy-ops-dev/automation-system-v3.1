/**
 * Chat Container
 * 
 * Claude Desktop 스타일의 메인 채팅 인터페이스
 */

import React, { useEffect, useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';

import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { WorkflowProgress } from './WorkflowProgress';
import { ConnectionStatus } from './ConnectionStatus';

import { workflowApi, webSocketService } from '@/services';
import { useAuthStore } from '@/stores';
import type { 
  ChatUIState, 
  ChatAction, 
  ChatUIMessage, 
  ExecutionProgress,
  WorkflowProgressUpdate,
  ChatResponseUpdate,
  ExecutionUpdateMessage
} from '@/types';

// Chat State Reducer
function chatReducer(state: ChatUIState, action: ChatAction): ChatUIState {
  switch (action.type) {
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload],
        inputText: ''
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id 
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      };
    
    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_EXECUTION':
      return { ...state, currentExecution: action.payload };
    
    case 'UPDATE_EXECUTION':
      return {
        ...state,
        currentExecution: state.currentExecution 
          ? { ...state.currentExecution, ...action.payload }
          : null
      };
    
    case 'UPDATE_STEP':
      return {
        ...state,
        currentExecution: state.currentExecution
          ? {
              ...state.currentExecution,
              steps: state.currentExecution.steps.map(step =>
                step.stepId === action.payload.stepId
                  ? { ...step, ...action.payload.updates }
                  : step
              )
            }
          : null
      };
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    
    case 'RESET_CHAT':
      return {
        ...state,
        messages: [],
        currentExecution: null,
        inputText: '',
        error: null,
        isLoading: false,
        isTyping: false
      };
    
    default:
      return state;
  }
}

// Initial State
const initialState: ChatUIState = {
  sessionId: null,
  messages: [],
  currentExecution: null,
  isConnected: false,
  isLoading: false,
  error: null,
  inputText: '',
  isTyping: false,
};

export const ChatContainer: React.FC = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // 세션 초기화
  useEffect(() => {
    const sessionId = uuidv4();
    dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
  }, []);

  // WebSocket 연결 설정
  useEffect(() => {
    // 인증 토큰 확인 - Zustand store에서 가져오기
    const authState = useAuthStore.getState();
    const token = authState.accessToken;
    
    if (!token) {
      console.warn('[ChatContainer] No auth token found, skipping WebSocket connection');
      return;
    }

    // 연결 상태 구독
    const unsubscribeConnection = webSocketService.subscribe('connection_status', () => {
      const wsState = webSocketService.getState();
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: wsState.isConnected });
    });

    // 워크플로우 진행 상태 구독
    const unsubscribeWorkflow = webSocketService.subscribe('workflow_progress', (message) => {
      handleWorkflowProgress(message.payload as WorkflowProgressUpdate);
    });

    // 채팅 응답 구독
    const unsubscribeChat = webSocketService.subscribe('chat_response', (message) => {
      handleChatResponse(message.payload as ChatResponseUpdate);
    });
    
    // 실행 업데이트 구독
    const unsubscribeExecution = webSocketService.subscribe('execution_update', (message) => {
      const update = message.payload as ExecutionUpdateMessage;
      if (update.executionId === state.currentExecution?.executionId) {
        dispatch({
          type: 'UPDATE_EXECUTION',
          payload: {
            status: update.status,
            finishedAt: update.finishedAt ? new Date(update.finishedAt) : undefined,
            error: update.error
          }
        });
      }
    });

    // 에러 구독
    const unsubscribeError = webSocketService.subscribe('error', (message) => {
      const error = message.payload as any;
      // WebSocket 인증 에러는 콘솔에만 출력 (반복적인 토스트 방지)
      if (error.message?.includes('Authentication required')) {
        console.warn('[ChatContainer] WebSocket authentication error');
      } else {
        toast.error(error.message || 'An error occurred');
      }
      dispatch({ type: 'SET_ERROR', payload: error.message });
    });

    // WebSocket 연결
    webSocketService.connect();

    return () => {
      unsubscribeConnection();
      unsubscribeWorkflow();
      unsubscribeChat();
      unsubscribeExecution();
      unsubscribeError();
    };
  }, []);

  // 워크플로우 진행 상태 처리
  const handleWorkflowProgress = useCallback((update: WorkflowProgressUpdate) => {
    if (update.stepUpdate) {
      dispatch({
        type: 'UPDATE_STEP',
        payload: {
          stepId: update.stepUpdate.stepId,
          updates: {
            status: update.stepUpdate.status === 'started' ? 'running' : 
                   update.stepUpdate.status === 'completed' ? 'completed' : 'failed',
            progress: update.stepUpdate.progress,
            result: update.stepUpdate.result,
            output: update.stepUpdate.output,
            error: update.stepUpdate.error,
          }
        }
      });
    }

    if (update.overallProgress !== undefined) {
      dispatch({
        type: 'UPDATE_EXECUTION',
        payload: { overallProgress: update.overallProgress }
      });
    }
  }, []);

  // 채팅 응답 처리
  const handleChatResponse = useCallback((response: ChatResponseUpdate) => {
    if (response.streaming && response.chunk) {
      // 스트리밍 응답 처리
      dispatch({ type: 'SET_TYPING', payload: true });
      
      // 마지막 어시스턴트 메시지 업데이트 또는 새 메시지 생성
      const lastMessage = state.messages[state.messages.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.metadata?.streaming) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            id: lastMessage.id,
            updates: {
              content: lastMessage.content + response.chunk,
              metadata: {
                ...lastMessage.metadata,
                finished: response.finished
              }
            }
          }
        });
      } else {
        const newMessage: ChatUIMessage = {
          id: response.messageId,
          role: 'assistant',
          content: response.chunk,
          timestamp: new Date(),
          status: 'received',
          metadata: {
            streaming: true,
            finished: response.finished,
            ...response.metadata
          }
        };
        dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
      }

      if (response.finished) {
        dispatch({ type: 'SET_TYPING', payload: false });
      }
    } else if (response.content) {
      // 완전한 응답 처리
      const newMessage: ChatUIMessage = {
        id: response.messageId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        status: 'received',
        metadata: response.metadata
      };
      dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
      dispatch({ type: 'SET_TYPING', payload: false });
    }
  }, [state.messages]);

  // 메시지 전송
  const handleSendMessage = useCallback(async (message: string) => {
    if (!state.sessionId || !message.trim()) return;

    const userMessage: ChatUIMessage = {
      id: uuidv4(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      status: 'sending',
    };

    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // 워크플로우 실행 요청
      const response = await workflowApi.executeChatWorkflow({
        sessionId: state.sessionId,
        message: message.trim(),
        context: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        },
        options: {
          async: true,
          timeout: 300
        }
      });

      // 사용자 메시지 상태 업데이트
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: userMessage.id,
          updates: { 
            status: 'sent',
            metadata: {
              executionId: response.executionId,
              workflowId: response.workflowId || undefined
            }
          }
        }
      });

      // 실행 상태 설정
      if (response.steps) {
        const execution: ExecutionProgress = {
          executionId: response.executionId,
          workflowId: response.workflowId || '',
          status: response.status,
          overallProgress: 0,
          steps: response.steps.map(step => ({
            stepId: step.stepId,
            stepName: step.name,
            status: step.status,
            progress: 0
          })),
          startedAt: new Date(),
          estimatedTimeRemaining: response.estimatedDuration
        };
        dispatch({ type: 'SET_EXECUTION', payload: execution });
      }

      toast.success('워크플로우가 시작되었습니다.');
    } catch (error) {
      console.error('Failed to send message:', error);
      
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: userMessage.id,
          updates: { 
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to send message'
          }
        }
      });
      
      toast.error('메시지 전송에 실패했습니다.');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.sessionId]);

  // 워크플로우 취소
  const handleCancelWorkflow = useCallback(async () => {
    if (!state.currentExecution) return;

    try {
      await workflowApi.cancelExecution(state.currentExecution.executionId);
      dispatch({ type: 'SET_EXECUTION', payload: null });
      toast.success('워크플로우가 취소되었습니다.');
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      toast.error('워크플로우 취소에 실패했습니다.');
    }
  }, [state.currentExecution]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 연결 상태 표시 */}
      <ConnectionStatus isConnected={state.isConnected} />

      {/* 메시지 영역 */}
      <div className="flex-1 flex flex-col min-h-0">
        <MessageList 
          messages={state.messages}
          currentExecution={state.currentExecution}
          isTyping={state.isTyping}
          className="flex-1"
        />

        {/* 워크플로우 진행 상태 */}
        {state.currentExecution && (
          <WorkflowProgress 
            execution={state.currentExecution}
            onCancel={handleCancelWorkflow}
            className="border-t border-gray-200 dark:border-gray-700"
          />
        )}
      </div>

      {/* 입력 영역 */}
      <MessageInput
        value={state.inputText}
        onChange={(value) => dispatch({ type: 'SET_INPUT_TEXT', payload: value })}
        onSend={handleSendMessage}
        isLoading={state.isLoading}
        isConnected={state.isConnected}
        className="border-t border-gray-200 dark:border-gray-700"
      />
    </div>
  );
};

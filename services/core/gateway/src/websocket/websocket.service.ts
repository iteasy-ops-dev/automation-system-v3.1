/**
 * WebSocket Service for external access
 * Provides methods to send messages through WebSocket from other parts of the application
 */

import { WebSocketHandler } from './websocket.handler';
import { WebSocketMessage, MessageType } from './websocket.types';

export class WebSocketService {
  private static instance: WebSocketService;
  private handler?: WebSocketHandler;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public setHandler(handler: WebSocketHandler): void {
    this.handler = handler;
  }

  /**
   * Send execution update to specific user
   */
  public sendExecutionUpdate(
    userId: string,
    executionId: string,
    status: string,
    progress: number,
    currentStep?: any
  ): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type: 'execution_update',
      timestamp: new Date().toISOString(),
      payload: {
        executionId,
        status,
        progress,
        currentStep
      },
      metadata: {
        messageId: this.generateMessageId(),
        userId,
        version: '1.0.0'
      }
    };

    this.handler.sendToUser(userId, message);
  }

  /**
   * Send metric update
   */
  public sendMetricUpdate(
    deviceId: string,
    deviceName: string,
    metrics: any,
    userId?: string
  ): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type: 'metric_update',
      timestamp: new Date().toISOString(),
      payload: {
        deviceId,
        deviceName,
        metrics
      },
      metadata: {
        messageId: this.generateMessageId(),
        userId,
        version: '1.0.0'
      }
    };

    if (userId) {
      this.handler.sendToUser(userId, message);
    } else {
      this.handler.broadcast('metrics', message);
    }
  }

  /**
   * Send device status update
   */
  public sendDeviceStatusUpdate(
    deviceId: string,
    deviceName: string,
    previousStatus: string,
    currentStatus: string,
    reason?: string
  ): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type: 'device_status',
      timestamp: new Date().toISOString(),
      payload: {
        deviceId,
        deviceName,
        previousStatus,
        currentStatus,
        reason,
        lastHeartbeat: new Date().toISOString()
      },
      metadata: {
        messageId: this.generateMessageId(),
        version: '1.0.0'
      }
    };

    this.handler.broadcast('devices', message);
  }

  /**
   * Send workflow progress update
   */
  public sendWorkflowProgress(
    userId: string,
    executionId: string,
    workflowId: string,
    workflowName: string,
    stepUpdate: any,
    overallProgress: number
  ): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type: 'workflow_progress',
      timestamp: new Date().toISOString(),
      payload: {
        executionId,
        workflowId,
        workflowName,
        stepUpdate,
        overallProgress
      },
      metadata: {
        messageId: this.generateMessageId(),
        userId,
        version: '1.0.0'
      }
    };

    this.handler.sendToUser(userId, message);
  }

  /**
   * Send chat response (streaming or complete)
   */
  public sendChatResponse(
    sessionId: string,
    messageId: string,
    content: string,
    streaming: boolean = false,
    finished: boolean = false
  ): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type: 'chat_response',
      timestamp: new Date().toISOString(),
      payload: {
        sessionId,
        messageId,
        content,
        streaming,
        finished
      },
      metadata: {
        messageId: this.generateMessageId(),
        sessionId,
        version: '1.0.0'
      }
    };

    this.handler.sendToSession(sessionId, message);
  }

  /**
   * Send alert
   */
  public sendAlert(
    severity: 'low' | 'medium' | 'high' | 'critical',
    category: string,
    title: string,
    message: string,
    source: any,
    userId?: string
  ): void {
    if (!this.handler) return;

    const alertMessage: WebSocketMessage = {
      type: 'alert',
      timestamp: new Date().toISOString(),
      payload: {
        alertId: this.generateMessageId(),
        severity,
        category,
        title,
        message,
        source
      },
      metadata: {
        messageId: this.generateMessageId(),
        userId,
        priority: severity === 'critical' ? 'urgent' : 'normal',
        version: '1.0.0'
      }
    };

    if (userId) {
      this.handler.sendToUser(userId, alertMessage);
    } else {
      this.handler.broadcast('alerts', alertMessage);
    }
  }

  /**
   * Send error message
   */
  public sendError(
    sessionId: string,
    errorMessage: string,
    details?: any,
    recoverable: boolean = true
  ): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type: 'error',
      timestamp: new Date().toISOString(),
      payload: {
        errorId: this.generateMessageId(),
        message: errorMessage,
        details,
        recoverable,
        retryable: false
      },
      metadata: {
        messageId: this.generateMessageId(),
        sessionId,
        version: '1.0.0'
      }
    };

    this.handler.sendToSession(sessionId, message);
  }

  /**
   * Broadcast message to channel
   */
  public broadcast(channel: string, type: MessageType, payload: any): void {
    if (!this.handler) return;

    const message: WebSocketMessage = {
      type,
      timestamp: new Date().toISOString(),
      payload,
      metadata: {
        messageId: this.generateMessageId(),
        version: '1.0.0'
      }
    };

    this.handler.broadcast(channel, message);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const websocketService = WebSocketService.getInstance();

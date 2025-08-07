/**
 * WebSocket Service Export Interface
 * Provides methods for other services to send WebSocket messages
 */

import { websocketService } from '../websocket/websocket.service';

// Re-export for use by other services
export { websocketService };

// Convenience methods for common operations
export const sendWorkflowUpdate = (
  userId: string,
  executionId: string,
  status: string,
  progress: number
) => {
  websocketService.sendExecutionUpdate(userId, executionId, status, progress);
};

export const sendDeviceAlert = (
  deviceId: string,
  deviceName: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string
) => {
  websocketService.sendAlert(
    severity,
    'device',
    `Device Alert: ${deviceName}`,
    message,
    { type: 'device', id: deviceId, name: deviceName }
  );
};

export const broadcastSystemAlert = (
  severity: 'low' | 'medium' | 'high' | 'critical',
  title: string,
  message: string
) => {
  websocketService.sendAlert(
    severity,
    'system',
    title,
    message,
    { type: 'system', id: 'gateway', name: 'API Gateway' }
  );
};

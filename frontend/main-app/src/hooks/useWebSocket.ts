/**
 * WebSocket Hook
 */

import { useEffect, useRef, useState } from 'react';

export interface UseWebSocketConfig {
  url: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  shouldReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(config: UseWebSocketConfig) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    try {
      const ws = new WebSocket(config.url);
      
      ws.onopen = () => {
        setIsConnected(true);
        config.onOpen?.();
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        config.onClose?.();
        
        if (config.shouldReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, config.reconnectInterval || 3000);
        }
      };
      
      ws.onerror = (error) => {
        config.onError?.(error);
      };
      
      ws.onmessage = (event) => {
        config.onMessage?.(event);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      config.onError?.(error as Event);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [config.url]);

  return {
    isConnected,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
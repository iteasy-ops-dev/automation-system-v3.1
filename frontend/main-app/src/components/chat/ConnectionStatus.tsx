/**
 * Connection Status Component
 * 
 * WebSocket 연결 상태 표시
 */

import React, { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  const [showDisconnectedMessage, setShowDisconnectedMessage] = useState(false);
  const [hasEverBeenConnected, setHasEverBeenConnected] = useState(false);

  useEffect(() => {
    if (isConnected) {
      // 연결되면 즉시 메시지 숨김
      setShowDisconnectedMessage(false);
      setHasEverBeenConnected(true);
    } else {
      // 🔥 핵심 수정: 초기 로딩 시간 단축 (5초 → 2초)
      if (!hasEverBeenConnected) {
        // 초기 로딩 중에는 2초 후에만 메시지 표시
        const timer = setTimeout(() => {
          if (!isConnected) { // 타이머 실행 시점에 다시 한 번 확인
            setShowDisconnectedMessage(true);
          }
        }, 2000); // 5초 → 2초로 단축

        return () => clearTimeout(timer);
      } else {
        // 이미 연결되었다가 끊어진 경우 즉시 메시지 표시
        setShowDisconnectedMessage(true);
      }
    }
  }, [isConnected, hasEverBeenConnected]);

  // 메시지를 표시하지 않는 경우들:
  // 1. 연결되어 있는 경우
  // 2. 한 번도 연결된 적이 없고 메시지 표시 시간이 되지 않은 경우
  if (isConnected || !showDisconnectedMessage) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
      <div className="flex items-center justify-center space-x-2 text-yellow-800 dark:text-yellow-200">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium">
          {hasEverBeenConnected 
            ? "서버 연결이 끊어졌습니다. 재연결 시도 중..."
            : "서버에 연결하고 있습니다..."
          }
        </span>
        <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

/**
 * Chat Page
 * 
 * Claude Desktop 스타일의 채팅 인터페이스
 */

import React from 'react';
import { ChatContainer } from '@/components/chat';

export const ChatPage: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      {/* 페이지 헤더 */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              AI 워크플로우 채팅
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              자연어로 IT 인프라를 제어하고 모니터링하세요
            </p>
          </div>
          
          {/* 새 대화 버튼 */}
          <button 
            onClick={() => window.location.reload()}
            className="
              px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white 
              rounded-lg transition-colors font-medium text-sm
              flex items-center space-x-2
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>새 대화</span>
          </button>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 min-h-0">
        <ChatContainer />
      </div>
    </div>
  );
};

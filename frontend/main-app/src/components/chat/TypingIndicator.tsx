/**
 * Typing Indicator
 * 
 * 어시스턴트가 응답 중일 때 표시되는 타이핑 인디케이터
 */

import React from 'react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] order-1">
        <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-2xl mr-4">
          <div className="flex items-center space-x-1">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-sm text-gray-500 ml-2">응답 중...</span>
          </div>
        </div>
      </div>

      {/* 아바타 */}
      <div className="w-8 h-8 rounded-full flex-shrink-0 order-2 mr-3">
        <div className="w-full h-full bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

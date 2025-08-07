/**
 * Message List Component
 * 
 * 채팅 메시지 히스토리 표시
 */

import React, { useEffect, useRef } from 'react';
import type { MessageListProps } from '@/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping,
  className = '',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className={`flex flex-col overflow-y-auto p-4 space-y-4 ${className}`}>
      {messages.length === 0 ? (
        <WelcomeMessage />
      ) : (
        messages.map((message) => (
          <MessageBubble 
            key={message.id} 
            message={message}
          />
        ))
      )}
      
      {isTyping && <TypingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

// 환영 메시지
const WelcomeMessage: React.FC = () => (
  <div className="text-center py-12">
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        안녕하세요! 🚀
      </h3>
      
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        자연어로 IT 인프라를 제어해보세요.<br />
        예: "모든 웹 서버의 CPU 사용률을 확인해줘"
      </p>
      
      <div className="mt-6 text-xs text-gray-500 dark:text-gray-500">
        <div className="flex items-center justify-center space-x-4">
          <span className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            실시간 모니터링
          </span>
          <span className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
            자동 워크플로우
          </span>
        </div>
      </div>
    </div>
  </div>
);

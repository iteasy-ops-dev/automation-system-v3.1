/**
 * Message Bubble Component
 * 
 * 개별 메시지 표시 (Claude Desktop 스타일)
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatUIMessage } from '@/types';
import { formatTimestamp } from '@/utils';

interface MessageBubbleProps {
  message: ChatUIMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return <SystemMessage message={message} />;
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* 메시지 버블 */}
        <div
          className={`
            px-4 py-3 rounded-2xl relative
            ${isUser
              ? 'bg-blue-600 text-white ml-4'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-4'
            }
            ${message.status === 'error' ? 'border-2 border-red-500' : ''}
          `}
        >
          {/* 메시지 내용 */}
          <MessageContent content={message.content} isUser={isUser} />
          
          {/* 메타데이터 */}
          {message.metadata && (
            <MessageMetadata metadata={message.metadata} isUser={isUser} />
          )}
          
          {/* 에러 표시 */}
          {message.error && (
            <div className="mt-2 text-xs text-red-300 bg-red-500/20 px-2 py-1 rounded">
              오류: {message.error}
            </div>
          )}
        </div>

        {/* 상태 및 시간 */}
        <div className={`flex items-center mt-1 text-xs text-gray-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <MessageStatus status={message.status} />
          <span className="ml-2">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>

      {/* 아바타 */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 ${isUser ? 'order-1 ml-3' : 'order-2 mr-3'}`}>
        {isUser ? (
          <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">U</span>
          </div>
        ) : (
          <div className="w-full h-full bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

// 메시지 내용 렌더링 (마크다운 지원)
const MessageContent: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser }) => {
  if (isUser) {
    // 사용자 메시지는 단순 텍스트로 표시
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  // AI 응답은 마크다운으로 렌더링
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          // 코드 블록 하이라이팅
          code({node, inline, className, children, ...props}: any) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              customStyle={{
                margin: '0.5rem 0',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              } as React.CSSProperties}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code 
              className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        // 링크는 새 탭에서 열기
        a({node, children, ...props}: any) {
          return (
            <a 
              {...props} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          );
        },
        // 테이블 스타일
        table({node, children, ...props}: any) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700" {...props}>
                {children}
              </table>
            </div>
          );
        },
        th({node, children, ...props}: any) {
          return (
            <th className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props}>
              {children}
            </th>
          );
        },
        td({node, children, ...props}: any) {
          return (
            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100" {...props}>
              {children}
            </td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};

// 메시지 메타데이터
const MessageMetadata: React.FC<{ 
  metadata: any; 
  isUser: boolean; 
}> = ({ metadata, isUser }) => {
  if (!metadata.workflowId && !metadata.tokenUsage) return null;

  return (
    <div className={`mt-2 text-xs ${isUser ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
      {metadata.workflowId && (
        <div>워크플로우: {metadata.workflowId}</div>
      )}
      {metadata.tokenUsage && (
        <div>토큰: {metadata.tokenUsage.totalTokens} (${metadata.tokenUsage.cost?.toFixed(4)})</div>
      )}
    </div>
  );
};

// 메시지 상태 표시
const MessageStatus: React.FC<{ status: ChatUIMessage['status'] }> = ({ status }) => {
  switch (status) {
    case 'sending':
      return (
        <div className="flex items-center">
          <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full mr-1"></div>
          <span>전송 중</span>
        </div>
      );
    case 'sent':
      return (
        <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'received':
      return null;
    case 'error':
      return (
        <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
};

// 시스템 메시지
const SystemMessage: React.FC<{ message: ChatUIMessage }> = ({ message }) => (
  <div className="flex justify-center">
    <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-lg text-sm">
      {message.content}
    </div>
  </div>
);

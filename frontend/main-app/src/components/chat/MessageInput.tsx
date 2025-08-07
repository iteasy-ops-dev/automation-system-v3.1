/**
 * Message Input Component
 * 
 * 메시지 입력창 (자동 크기 조정, 엔터 전송)
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageInputProps } from '@/types';

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  onFileUpload,
  isLoading,
  isConnected,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 자동 높이 조정
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  // 전송 처리
  const handleSend = () => {
    if (!value.trim() || isLoading || !isConnected) return;
    onSend(value.trim());
  };

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: 줄바꿈
        return;
      } else {
        // Enter: 전송
        e.preventDefault();
        handleSend();
      }
    }
  };

  // 파일 드래그 앤 드롭
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (onFileUpload && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFileUpload(files);
    }
  };

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onFileUpload && e.target.files?.length) {
      const files = Array.from(e.target.files);
      onFileUpload(files);
      e.target.value = ''; // 파일 입력 초기화
    }
  };

  const canSend = value.trim() && !isLoading && isConnected;

  return (
    <div className={`bg-white dark:bg-gray-900 ${className}`}>
      {/* 연결 상태 경고 */}
      {!isConnected && (
        <div className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm text-center">
          서버 연결이 끊어졌습니다. 재연결 시도 중...
        </div>
      )}

      <div 
        className={`
          p-4 border-2 border-dashed transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-transparent'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-end space-x-3">
          {/* 파일 업로드 버튼 */}
          {onFileUpload && (
            <label className="flex-shrink-0 cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".txt,.md,.json,.csv,.log"
              />
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
            </label>
          )}

          {/* 텍스트 입력 영역 */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !isConnected 
                  ? "연결 대기 중..." 
                  : "메시지를 입력하세요... (Shift + Enter로 줄바꿈)"
              }
              disabled={!isConnected}
              className="
                w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 
                border border-gray-200 dark:border-gray-700 
                rounded-xl resize-none outline-none
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                text-gray-900 dark:text-gray-100
                placeholder-gray-500 dark:placeholder-gray-400
              "
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />

            {/* 문자 수 표시 */}
            <div className="absolute bottom-1 right-2 text-xs text-gray-400">
              {value.length}/2000
            </div>
          </div>

          {/* 전송 버튼 */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
              ${canSend
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }
              ${isLoading ? 'animate-pulse' : ''}
            `}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* 드래그 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <div className="text-blue-600 dark:text-blue-400 text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="font-medium">파일을 여기에 놓으세요</p>
            </div>
          </div>
        )}
      </div>

      {/* 도움말 */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Enter로 전송</span>
            <span>Shift + Enter로 줄바꿈</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? '연결됨' : '연결 끊김'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

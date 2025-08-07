/**
 * Workflow Progress Component
 * 
 * 워크플로우 실행 진행 상태 표시
 */

import React from 'react';
import { WorkflowProgressProps } from '@/types';
import { formatDuration } from '@/utils';

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  execution,
  onCancel,
  className = '',
}) => {
  const { status, overallProgress, currentStep, steps, estimatedTimeRemaining } = execution;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 p-4 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full ${getStatusColor(status)} text-white flex items-center justify-center`}>
            {getStatusIcon(status)}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              워크플로우 실행 중
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {execution.workflowName || execution.workflowId}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 예상 남은 시간 */}
          {estimatedTimeRemaining && status === 'running' && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              약 {formatDuration(estimatedTimeRemaining * 1000)} 남음
            </span>
          )}

          {/* 취소 버튼 */}
          {onCancel && status === 'running' && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* 전체 진행률 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">전체 진행률</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {overallProgress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(status)}`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* 현재 단계 */}
      {currentStep && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              현재: {currentStep.stepName}
            </span>
          </div>
          {currentStep.progress !== undefined && (
            <div className="mt-2">
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1">
                <div
                  className="h-1 bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${currentStep.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 단계별 상세 정보 */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          실행 단계
        </div>
        {steps.map((step, index) => (
          <div key={step.stepId} className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {step.status === 'completed' ? (
                <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : step.status === 'running' ? (
                <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              ) : step.status === 'failed' ? (
                <div className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{index + 1}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {step.stepName}
              </div>
              {step.output && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                  {step.output}
                </div>
              )}
              {step.error && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  오류: {step.error}
                </div>
              )}
            </div>

            {step.progress !== undefined && step.status === 'running' && (
              <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {step.progress}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

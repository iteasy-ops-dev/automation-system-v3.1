/**
 * MCP Tool Catalog Component
 * 
 * MCP 서버의 도구 목록을 표시하는 컴포넌트
 */

import React from 'react';
import { MCPTool, MCPToolCatalog } from '@/types';

interface MCPToolCatalogProps {
  catalog: MCPToolCatalog | null;
  loading: boolean;
  onExecuteTool: (tool: MCPTool) => void;
  onRefresh: () => void;
  className?: string;
}

export const MCPToolCatalogComponent: React.FC<MCPToolCatalogProps> = ({
  catalog,
  loading,
  onExecuteTool,
  onRefresh,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center ${className}`}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">도구 정보를 불러올 수 없습니다</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          서버에 연결하여 도구 목록을 가져오세요.
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          새로고침
        </button>
      </div>
    );
  }

  if (catalog.tools.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center ${className}`}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">사용 가능한 도구가 없습니다</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          이 서버에는 등록된 도구가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {catalog.serverName} 도구 목록
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {catalog.tools.length}개의 도구 사용 가능
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalog.tools.map((tool) => (
            <div
              key={tool.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {tool.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {tool.description}
                  </p>
                </div>
                {tool.version && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ml-2">
                    v{tool.version}
                  </span>
                )}
              </div>

              {/* 파라미터 정보 */}
              {tool.parameters && tool.parameters.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">파라미터:</h5>
                  <div className="flex flex-wrap gap-1">
                    {tool.parameters.slice(0, 3).map((param, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          param.required 
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' 
                            : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        }`}
                      >
                        {param.name}
                        {param.required && '*'}
                      </span>
                    ))}
                    {tool.parameters.length > 3 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{tool.parameters.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 태그/카테고리 */}
              {(tool.category || (tool.tags && tool.tags.length > 0)) && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tool.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                      {tool.category}
                    </span>
                  )}
                  {tool.tags?.slice(0, 2).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 실행 버튼 */}
              <div className="mt-4">
                <button
                  onClick={() => onExecuteTool(tool)}
                  className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  실행
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          마지막 업데이트: {new Date(catalog.lastUpdated).toLocaleString('ko-KR')}
        </p>
      </div>
    </div>
  );
};

export default MCPToolCatalogComponent;

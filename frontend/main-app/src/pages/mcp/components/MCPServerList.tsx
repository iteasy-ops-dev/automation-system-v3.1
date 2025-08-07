/**
 * MCP Server List Component
 * 
 * MCP 서버 목록을 카드 형태로 표시
 * Model Context Protocol 표준 준수
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MCPServer, MCPTransport } from '@/types';
import { MCPConnectionStatus } from './MCPConnectionStatus';

interface MCPServerListProps {
  servers: MCPServer[];
  loading: boolean;
  onServerClick: (server: MCPServer) => void;
  onEditServer: (server: MCPServer) => void;
  onDeleteServer: (server: MCPServer) => void;
  onTestConnection: (server: MCPServer) => void;
  onViewTools: (server: MCPServer) => void;
  serverToolsCounts?: Record<string, number>;
  className?: string;
}

const transportIcons: Record<MCPTransport, JSX.Element> = {
  stdio: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  ssh: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  docker: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  http: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
};

const transportLabels: Record<MCPTransport, string> = {
  stdio: 'Standard I/O',
  ssh: 'SSH',
  docker: 'Docker',
  http: 'HTTP',
};

export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  loading,
  onServerClick,
  onEditServer,
  onDeleteServer,
  onTestConnection,
  onViewTools,
  serverToolsCounts = {},
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4"></div>
            <div className="flex space-x-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">MCP 서버가 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            MCP (Model Context Protocol) 서버를 등록하여 시작하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {servers.map((server) => (
        <div
          key={server.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onServerClick(server)}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {server.name}
              </h3>
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                {transportIcons[server.transport]}
                <span className="text-sm">{transportLabels[server.transport]}</span>
              </div>
            </div>

            {server.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {server.description}
              </p>
            )}

            <div className="space-y-2 mb-4">
              {/* Transport별 연결 정보 표시 */}
              {server.transport === 'stdio' && server.command && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">명령어:</span> {server.command}
                </div>
              )}
              
              {server.transport === 'ssh' && server.sshConfig && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">SSH:</span> {server.sshConfig.username}@{server.sshConfig.host}:{server.sshConfig.port}
                </div>
              )}
              
              {server.transport === 'docker' && server.dockerConfig && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Docker:</span> {server.dockerConfig.image}
                </div>
              )}
              
              {server.transport === 'http' && server.httpConfig && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">URL:</span> {server.httpConfig.url}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <MCPConnectionStatus status={server.connectionStatus || 'disconnected'} />
              <div className="flex items-center space-x-3">
                {serverToolsCounts[server.id] !== undefined && (
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    도구: {serverToolsCounts[server.id]}개
                  </span>
                )}
                {server.serverInfo && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    v{server.serverInfo.version}
                  </span>
                )}
              </div>
            </div>

            {/* 서버 기능 표시 */}
            {server.serverInfo?.capabilities && (
              <div className="flex flex-wrap gap-2 mb-4">
                {server.serverInfo.capabilities.tools && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    Tools
                  </span>
                )}
                {server.serverInfo.capabilities.resources && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    Resources
                  </span>
                )}
                {server.serverInfo.capabilities.prompts && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    Prompts
                  </span>
                )}
                {server.serverInfo.capabilities.logging && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                    Logging
                  </span>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              등록: {formatDistanceToNow(new Date(server.createdAt), { addSuffix: true, locale: ko })}
            </div>

            <div className="flex items-center justify-between">
              <div
                className="flex space-x-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onTestConnection(server)}
                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  연결 테스트
                </button>
                <button
                  onClick={() => onViewTools(server)}
                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                  </svg>
                  도구 보기
                </button>
              </div>
              
              <div
                className="flex space-x-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onEditServer(server)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteServer(server)}
                  className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MCPServerList;

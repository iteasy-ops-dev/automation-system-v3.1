/**
 * MCP Servers Page - MCP 서버 관리 페이지
 * 
 * 실제 백엔드 MCP Integration Service와 연동
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { 
  MCPServer,
  MCPServerFilters,
  MCPServerCreateRequest,
  MCPServerUpdateRequest,
  MCPTool,
  MCPConnectionTest,
} from '@/types';
import { mcpService } from '@/services';

// Components
import MCPServerList from './components/MCPServerList';
import MCPServerForm from './components/MCPServerForm';
import MCPToolCatalogComponent from './components/MCPToolCatalog';

interface MCPServersPageProps {
  className?: string;
}

const MCP_SERVERS_QUERY_KEY = 'mcp-servers';
const MCP_TOOLS_QUERY_KEY = 'mcp-tools';

export const MCPServersPage: React.FC<MCPServersPageProps> = ({ className = '' }) => {
  const queryClient = useQueryClient();
  
  // Local state
  const [filters] = useState<MCPServerFilters>({
    limit: 20,
    offset: 0,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  // Remove unused selectedServer state
  const [showToolCatalog, setShowToolCatalog] = useState(false);
  const [toolCatalogServerId, setToolCatalogServerId] = useState<string | null>(null);
  const [totalToolsCount, setTotalToolsCount] = useState<number>(0);
  const [loadingToolsCount, setLoadingToolsCount] = useState<boolean>(true);
  const [serverToolsCounts, setServerToolsCounts] = useState<Record<string, number>>({});

  // Query: MCP 서버 목록 조회
  const {
    data: serversResponse,
    isLoading: serversLoading,
    error: serversError,
  } = useQuery({
    queryKey: [MCP_SERVERS_QUERY_KEY, filters],
    queryFn: () => mcpService.getServers(filters),
    keepPreviousData: true,
  });

  // Query: 도구 카탈로그 조회
  const {
    data: toolCatalog,
    isLoading: toolsLoading,
    error: toolsError,
  } = useQuery({
    queryKey: [MCP_TOOLS_QUERY_KEY, toolCatalogServerId],
    queryFn: () => toolCatalogServerId ? mcpService.getServerTools(toolCatalogServerId) : null,
    enabled: !!toolCatalogServerId,
  });

  // Mutation: MCP 서버 생성
  const createServerMutation = useMutation({
    mutationFn: (data: MCPServerCreateRequest) => mcpService.createServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries([MCP_SERVERS_QUERY_KEY]);
      setShowForm(false);
      toast.success('MCP 서버가 성공적으로 등록되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'MCP 서버 등록에 실패했습니다.');
    },
  });

  // Mutation: MCP 서버 수정
  const updateServerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MCPServerUpdateRequest }) => 
      mcpService.updateServer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries([MCP_SERVERS_QUERY_KEY]);
      setEditingServer(null);
      setShowForm(false);
      toast.success('MCP 서버 정보가 성공적으로 수정되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'MCP 서버 수정에 실패했습니다.');
    },
  });

  // Mutation: MCP 서버 삭제
  const deleteServerMutation = useMutation({
    mutationFn: (id: string) => mcpService.deleteServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries([MCP_SERVERS_QUERY_KEY]);
      toast.success('MCP 서버가 성공적으로 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'MCP 서버 삭제에 실패했습니다.');
    },
  });

  // Mutation: 연결 테스트
  const testConnectionMutation = useMutation({
    mutationFn: (id: string) => mcpService.testConnection(id),
    onSuccess: (result: MCPConnectionTest) => {
      if (result.success) {
        toast.success(`연결 성공 (응답시간: ${result.responseTime}ms)`);
      } else {
        toast.error(`연결 실패: ${result.error}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || '연결 테스트에 실패했습니다.');
    },
  });

  // Mutation: 도구 디스커버리
  const discoverToolsMutation = useMutation({
    mutationFn: (serverId?: string) => mcpService.tools.discoverTools(serverId),
    onSuccess: (result) => {
      queryClient.invalidateQueries([MCP_TOOLS_QUERY_KEY]);
      queryClient.invalidateQueries([MCP_SERVERS_QUERY_KEY]);
      toast.success(`${result.toolsDiscovered}개의 새로운 도구를 발견했습니다.`);
      // 도구 개수 다시 가져오기
      if (serversResponse) {
        const fetchTotalToolsCount = async () => {
          setLoadingToolsCount(true);
          const toolsCounts: Record<string, number> = {};
          let total = 0;
          
          try {
            const toolsPromises = serversResponse.items.map(async (server) => {
              try {
                const tools = await mcpService.getServerTools(server.id);
                const count = tools.length;
                toolsCounts[server.id] = count;
                return count;
              } catch (error) {
                console.error(`Failed to get tools for server ${server.id}:`, error);
                toolsCounts[server.id] = 0;
                return 0;
              }
            });

            const counts = await Promise.all(toolsPromises);
            total = counts.reduce((sum, count) => sum + count, 0);
          } catch (error) {
            console.error('Failed to get total tools count:', error);
          } finally {
            setTotalToolsCount(total);
            setServerToolsCounts(toolsCounts);
            setLoadingToolsCount(false);
          }
        };
        fetchTotalToolsCount();
      }
    },
    onError: (error: any) => {
      toast.error(error.message || '도구 디스커버리에 실패했습니다.');
    },
  });

  // Error handling
  useEffect(() => {
    if (serversError) {
      toast.error('MCP 서버 목록을 불러오는데 실패했습니다.');
    }
  }, [serversError]);

  useEffect(() => {
    if (toolsError) {
      toast.error('도구 목록을 불러오는데 실패했습니다.');
    }
  }, [toolsError]);

  // 총 도구 개수 계산
  useEffect(() => {
    const fetchTotalToolsCount = async () => {
      if (!serversResponse?.items || serversResponse.items.length === 0) {
        setTotalToolsCount(0);
        setLoadingToolsCount(false);
        setServerToolsCounts({});
        return;
      }

      setLoadingToolsCount(true);
      let total = 0;
      const toolsCounts: Record<string, number> = {};

      try {
        // 각 서버의 도구 개수를 병렬로 가져오기
        const toolsPromises = serversResponse.items.map(async (server) => {
          try {
            const tools = await mcpService.getServerTools(server.id);
            const count = tools.length;
            toolsCounts[server.id] = count;
            return count;
          } catch (error) {
            console.error(`Failed to get tools for server ${server.id}:`, error);
            toolsCounts[server.id] = 0;
            return 0;
          }
        });

        const counts = await Promise.all(toolsPromises);
        total = counts.reduce((sum, count) => sum + count, 0);
      } catch (error) {
        console.error('Failed to get total tools count:', error);
      } finally {
        setTotalToolsCount(total);
        setServerToolsCounts(toolsCounts);
        setLoadingToolsCount(false);
      }
    };

    fetchTotalToolsCount();
  }, [serversResponse]);

  // Handlers
  const handleServerClick = (server: MCPServer) => {
    console.log('Server clicked:', server);
  };

  const handleCreateServer = () => {
    setEditingServer(null);
    setShowForm(true);
  };

  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server);
    setShowForm(true);
  };

  const handleDeleteServer = async (server: MCPServer) => {
    if (window.confirm(`'${server.name}' MCP 서버를 정말 삭제하시겠습니까?`)) {
      deleteServerMutation.mutate(server.id);
    }
  };

  const handleTestConnection = (server: MCPServer) => {
    testConnectionMutation.mutate(server.id);
  };

  const handleViewTools = (server: MCPServer) => {
    setToolCatalogServerId(server.id);
    setShowToolCatalog(true);
  };

  const handleFormSubmit = async (data: MCPServerCreateRequest | MCPServerUpdateRequest) => {
    if (editingServer) {
      // 수정
      updateServerMutation.mutate({
        id: editingServer.id,
        data: data as MCPServerUpdateRequest,
      });
    } else {
      // 생성
      createServerMutation.mutate(data as MCPServerCreateRequest);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingServer(null);
  };

  const handleExecuteTool = (tool: MCPTool) => {
    // TODO: 도구 실행 모달 또는 페이지로 이동
    console.log('Execute tool:', tool);
    toast(`도구 실행 기능은 추후 구현될 예정입니다: ${tool.name}`);
  };

  const handleRefreshTools = () => {
    if (toolCatalogServerId) {
      discoverToolsMutation.mutate(toolCatalogServerId);
    } else {
      discoverToolsMutation.mutate(undefined);
    }
  };

  const servers = serversResponse?.items || [];
  const total = serversResponse?.total || 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MCP 서버 관리 (실제 구현됨 ✅)</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            MCP (Model Context Protocol) 서버들을 등록하고 관리할 수 있습니다. 현재 {total}개의 서버가 등록되어 있습니다.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => discoverToolsMutation.mutate(undefined)}
            disabled={discoverToolsMutation.isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {discoverToolsMutation.isLoading ? '검색 중...' : '도구 검색'}
          </button>
          <button
            onClick={handleCreateServer}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            서버 추가
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {serversResponse && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    전체 서버
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {total}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    활성 서버
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {servers.filter(s => s.status === 'active').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    연결됨
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {servers.filter(s => s.connectionStatus === 'connected').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    총 도구
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {loadingToolsCount ? '로딩 중...' : totalToolsCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MCP 서버 목록 */}
      <MCPServerList
        servers={servers}
        loading={serversLoading}
        onServerClick={handleServerClick}
        onEditServer={handleEditServer}
        onDeleteServer={handleDeleteServer}
        onTestConnection={handleTestConnection}
        onViewTools={handleViewTools}
        serverToolsCounts={serverToolsCounts}
      />

      {/* MCP 서버 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <MCPServerForm
                server={editingServer}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                loading={createServerMutation.isLoading || updateServerMutation.isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* 도구 카탈로그 모달 */}
      {showToolCatalog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">도구 카탈로그</h3>
                <button
                  onClick={() => setShowToolCatalog(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <MCPToolCatalogComponent
                  catalog={toolCatalog ? {
                    serverId: toolCatalogServerId!,
                    serverName: serversResponse?.items.find((s: MCPServer) => s.id === toolCatalogServerId)?.name || '',
                    tools: toolCatalog,
                    lastUpdated: new Date().toISOString()
                  } : null}
                  loading={toolsLoading}
                  onExecuteTool={handleExecuteTool}
                  onRefresh={handleRefreshTools}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPServersPage;

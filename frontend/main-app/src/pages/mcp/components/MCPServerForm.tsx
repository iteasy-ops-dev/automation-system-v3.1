/**
 * MCP Server Form Component
 * 
 * MCP 서버 등록/수정을 위한 폼
 * Model Context Protocol 표준 준수
 */

import React, { useState, useEffect } from 'react';
import { MCPServer, MCPServerCreateRequest, MCPServerUpdateRequest, MCPServerFormData, MCPTransport } from '@/types';

interface MCPServerFormProps {
  server?: MCPServer | null;
  onSubmit: (data: MCPServerCreateRequest | MCPServerUpdateRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const transportTypes: { value: MCPTransport; label: string; description: string }[] = [
  { 
    value: 'stdio', 
    label: 'Standard I/O', 
    description: '로컬 프로세스로 실행 (예: npx, python, node)' 
  },
  { 
    value: 'ssh', 
    label: 'SSH', 
    description: '원격 서버에서 SSH를 통해 실행' 
  },
  { 
    value: 'docker', 
    label: 'Docker', 
    description: 'Docker 컨테이너에서 실행' 
  },
  { 
    value: 'http', 
    label: 'HTTP', 
    description: 'HTTP 엔드포인트로 연결' 
  },
];

const initialFormData: MCPServerFormData = {
  name: '',
  description: '',
  transport: 'stdio',
  
  // stdio
  command: '',
  args: '',
  
  // ssh
  sshHost: '',
  sshPort: 22,
  sshUsername: '',
  sshPassword: '',
  sshPrivateKey: '',
  sshCommand: '',
  
  // docker
  dockerImage: '',
  dockerContainer: '',
  dockerCommand: '',
  
  // http
  httpUrl: '',
  httpHeaders: {},
  
  metadata: {},
};

export const MCPServerForm: React.FC<MCPServerFormProps> = ({
  server,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<MCPServerFormData>(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [usePrivateKey, setUsePrivateKey] = useState(false);
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!server;

  // 편집 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (server) {
      const data: MCPServerFormData = {
        name: server.name,
        description: server.description || '',
        transport: server.transport,
        
        // stdio
        command: server.command || '',
        args: server.args?.join(' ') || '',
        
        // ssh
        sshHost: server.sshConfig?.host || '',
        sshPort: server.sshConfig?.port || 22,
        sshUsername: server.sshConfig?.username || '',
        sshPassword: server.sshConfig?.password || '',
        sshPrivateKey: server.sshConfig?.privateKey || '',
        sshCommand: server.sshConfig?.command || '',
        
        // docker
        dockerImage: server.dockerConfig?.image || '',
        dockerContainer: server.dockerConfig?.container || '',
        dockerCommand: server.dockerConfig?.command?.join(' ') || '',
        
        // http
        httpUrl: server.httpConfig?.url || '',
        httpHeaders: server.httpConfig?.headers || {},
        
        metadata: (server.metadata as Record<string, string>) || {},
      };
      
      setFormData(data);
      setUsePrivateKey(!!server.sshConfig?.privateKey);
    } else {
      setFormData(initialFormData);
    }
  }, [server]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'MCP 서버명을 입력해주세요.';
    }

    // Transport별 검증
    switch (formData.transport) {
      case 'stdio':
        if (!formData.command.trim()) {
          newErrors.command = '실행 명령어를 입력해주세요.';
        }
        break;
        
      case 'ssh':
        if (!formData.sshHost.trim()) {
          newErrors.sshHost = 'SSH 호스트를 입력해주세요.';
        }
        if (!formData.sshUsername.trim()) {
          newErrors.sshUsername = 'SSH 사용자명을 입력해주세요.';
        }
        if (!usePrivateKey && !formData.sshPassword.trim()) {
          newErrors.sshPassword = 'SSH 비밀번호를 입력해주세요.';
        }
        if (usePrivateKey && !formData.sshPrivateKey.trim()) {
          newErrors.sshPrivateKey = 'SSH 개인키를 입력해주세요.';
        }
        if (!formData.sshCommand.trim()) {
          newErrors.sshCommand = 'SSH 명령어를 입력해주세요.';
        }
        break;
        
      case 'docker':
        if (!formData.dockerImage.trim()) {
          newErrors.dockerImage = 'Docker 이미지를 입력해주세요.';
        }
        break;
        
      case 'http':
        if (!formData.httpUrl.trim()) {
          newErrors.httpUrl = 'HTTP URL을 입력해주세요.';
        }
        try {
          new URL(formData.httpUrl);
        } catch {
          newErrors.httpUrl = '올바른 URL 형식이 아닙니다.';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      let submitData: MCPServerCreateRequest;
      
      const baseData = {
        name: formData.name,
        description: formData.description || undefined,
        transport: formData.transport,
        metadata: Object.keys(formData.metadata).length > 0 ? formData.metadata : undefined,
      };

      switch (formData.transport) {
        case 'stdio':
          submitData = {
            ...baseData,
            command: formData.command,
            args: formData.args.trim() ? formData.args.split(' ') : undefined,
          };
          break;
          
        case 'ssh':
          submitData = {
            ...baseData,
            sshConfig: {
              host: formData.sshHost,
              port: formData.sshPort,
              username: formData.sshUsername,
              password: usePrivateKey ? undefined : formData.sshPassword,
              privateKey: usePrivateKey ? formData.sshPrivateKey : undefined,
              command: formData.sshCommand,
            },
          };
          break;
          
        case 'docker':
          submitData = {
            ...baseData,
            dockerConfig: {
              image: formData.dockerImage,
              container: formData.dockerContainer || undefined,
              command: formData.dockerCommand.trim() ? formData.dockerCommand.split(' ') : undefined,
            },
          };
          break;
          
        case 'http':
          submitData = {
            ...baseData,
            httpConfig: {
              url: formData.httpUrl,
              headers: Object.keys(formData.httpHeaders).length > 0 ? formData.httpHeaders : undefined,
            },
          };
          break;
      }

      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleAddMetadata = () => {
    if (metadataKey.trim() && metadataValue.trim()) {
      setFormData({
        ...formData,
        metadata: {
          ...formData.metadata,
          [metadataKey.trim()]: metadataValue.trim(),
        },
      });
      setMetadataKey('');
      setMetadataValue('');
    }
  };

  const handleRemoveMetadata = (keyToRemove: string) => {
    const { [keyToRemove]: removed, ...rest } = formData.metadata;
    setFormData({
      ...formData,
      metadata: rest,
    });
  };

  const handleAddHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      setFormData({
        ...formData,
        httpHeaders: {
          ...formData.httpHeaders,
          [headerKey.trim()]: headerValue.trim(),
        },
      });
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const handleRemoveHeader = (keyToRemove: string) => {
    const { [keyToRemove]: removed, ...rest } = formData.httpHeaders;
    setFormData({
      ...formData,
      httpHeaders: rest,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {isEditing ? 'MCP 서버 수정' : '새 MCP 서버 등록'}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Model Context Protocol 표준을 준수하는 서버를 등록합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* 기본 정보 */}
        <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">기본 정보</h4>
          
          <div>
            <label htmlFor="server-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              서버명 *
            </label>
            <input
              id="server-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              placeholder="예: Claude Desktop MCP Server"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="server-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              설명
            </label>
            <textarea
              id="server-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={2}
              placeholder="MCP 서버의 용도나 기능을 설명해주세요."
            />
          </div>
        </div>

        {/* Transport 선택 */}
        <div>
          <label htmlFor="transport" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            연결 방식 (Transport) *
          </label>
          <select
            id="transport"
            value={formData.transport}
            onChange={(e) => setFormData({ ...formData, transport: e.target.value as MCPTransport })}
            disabled={isEditing} // 수정 시 transport 변경 불가
            className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
              errors.transport 
                ? 'border-red-300 dark:border-red-600' 
                : 'border-gray-300 dark:border-gray-600'
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
              isEditing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {transportTypes.map((transport) => (
              <option key={transport.value} value={transport.value}>
                {transport.label} - {transport.description}
              </option>
            ))}
          </select>
          {errors.transport && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.transport}</p>
          )}
          {isEditing && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              * 연결 방식은 수정할 수 없습니다. 변경이 필요한 경우 새로운 서버를 등록해주세요.
            </p>
          )}
        </div>

        {/* Transport별 설정 */}
        <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">연결 설정</h4>
          
          {/* Standard I/O 설정 */}
          {formData.transport === 'stdio' && (
            <>
              <div>
                <label htmlFor="command" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  실행 명령어 *
                </label>
                <input
                  id="command"
                  type="text"
                  value={formData.command}
                  onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.command 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                  placeholder="예: npx @modelcontextprotocol/server-filesystem"
                />
                {errors.command && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.command}</p>
                )}
              </div>

              <div>
                <label htmlFor="args" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  명령어 인자
                </label>
                <input
                  id="args"
                  type="text"
                  value={formData.args}
                  onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="예: /Users/leesg/Documents (공백으로 구분)"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  명령어에 전달할 인자들을 공백으로 구분하여 입력하세요.
                </p>
              </div>
            </>
          )}

          {/* SSH 설정 */}
          {formData.transport === 'ssh' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sshHost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH 호스트 *
                  </label>
                  <input
                    id="sshHost"
                    type="text"
                    value={formData.sshHost}
                    onChange={(e) => setFormData({ ...formData, sshHost: e.target.value })}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.sshHost 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                    placeholder="예: 192.168.1.100"
                  />
                  {errors.sshHost && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sshHost}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sshPort" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH 포트 *
                  </label>
                  <input
                    id="sshPort"
                    type="number"
                    value={formData.sshPort}
                    onChange={(e) => setFormData({ ...formData, sshPort: parseInt(e.target.value) || 22 })}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min="1"
                    max="65535"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sshUsername" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SSH 사용자명 *
                </label>
                <input
                  id="sshUsername"
                  type="text"
                  value={formData.sshUsername}
                  onChange={(e) => setFormData({ ...formData, sshUsername: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.sshUsername 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                  placeholder="예: ubuntu"
                />
                {errors.sshUsername && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sshUsername}</p>
                )}
              </div>

              {/* SSH 인증 방식 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  인증 방식
                </label>
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={!usePrivateKey}
                      onChange={() => setUsePrivateKey(false)}
                      className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">비밀번호</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={usePrivateKey}
                      onChange={() => setUsePrivateKey(true)}
                      className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">SSH 개인키</span>
                  </label>
                </div>
              </div>

              {!usePrivateKey ? (
                <div>
                  <label htmlFor="sshPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH 비밀번호 *
                  </label>
                  <div className="relative">
                    <input
                      id="sshPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.sshPassword}
                      onChange={(e) => setFormData({ ...formData, sshPassword: e.target.value })}
                      className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.sshPassword 
                          ? 'border-red-300 dark:border-red-600' 
                          : 'border-gray-300 dark:border-gray-600'
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-gray-400"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.sshPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sshPassword}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="sshPrivateKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH 개인키 *
                  </label>
                  <textarea
                    id="sshPrivateKey"
                    value={formData.sshPrivateKey}
                    onChange={(e) => setFormData({ ...formData, sshPrivateKey: e.target.value })}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.sshPrivateKey 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm`}
                    rows={4}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  />
                  {errors.sshPrivateKey && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sshPrivateKey}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="sshCommand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MCP 서버 실행 명령어 *
                </label>
                <input
                  id="sshCommand"
                  type="text"
                  value={formData.sshCommand}
                  onChange={(e) => setFormData({ ...formData, sshCommand: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.sshCommand 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                  placeholder="예: npx @modelcontextprotocol/server-filesystem /home/user"
                />
                {errors.sshCommand && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sshCommand}</p>
                )}
              </div>
            </>
          )}

          {/* Docker 설정 */}
          {formData.transport === 'docker' && (
            <>
              <div>
                <label htmlFor="dockerImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Docker 이미지 *
                </label>
                <input
                  id="dockerImage"
                  type="text"
                  value={formData.dockerImage}
                  onChange={(e) => setFormData({ ...formData, dockerImage: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.dockerImage 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                  placeholder="예: mcp-server:latest"
                />
                {errors.dockerImage && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dockerImage}</p>
                )}
              </div>

              <div>
                <label htmlFor="dockerContainer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  컨테이너 이름
                </label>
                <input
                  id="dockerContainer"
                  type="text"
                  value={formData.dockerContainer}
                  onChange={(e) => setFormData({ ...formData, dockerContainer: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="예: mcp-server-01 (선택사항)"
                />
              </div>

              <div>
                <label htmlFor="dockerCommand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  실행 명령어
                </label>
                <input
                  id="dockerCommand"
                  type="text"
                  value={formData.dockerCommand}
                  onChange={(e) => setFormData({ ...formData, dockerCommand: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="기본 CMD 사용 시 비워두세요"
                />
              </div>
            </>
          )}

          {/* HTTP 설정 */}
          {formData.transport === 'http' && (
            <>
              <div>
                <label htmlFor="httpUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  HTTP URL *
                </label>
                <input
                  id="httpUrl"
                  type="url"
                  value={formData.httpUrl}
                  onChange={(e) => setFormData({ ...formData, httpUrl: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.httpUrl 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                  placeholder="예: https://api.example.com/mcp"
                />
                {errors.httpUrl && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.httpUrl}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  HTTP 헤더
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="헤더 키"
                  />
                  <input
                    type="text"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="헤더 값"
                  />
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    추가
                  </button>
                </div>
                {Object.keys(formData.httpHeaders).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(formData.httpHeaders).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                      >
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          <span className="font-medium">{key}:</span> {value}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(key)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 메타데이터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            메타데이터
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={metadataKey}
              onChange={(e) => setMetadataKey(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="키"
            />
            <input
              type="text"
              value={metadataValue}
              onChange={(e) => setMetadataValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="값"
            />
            <button
              type="button"
              onClick={handleAddMetadata}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              추가
            </button>
          </div>
          {Object.keys(formData.metadata).length > 0 && (
            <div className="space-y-1">
              {Object.entries(formData.metadata).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    <span className="font-medium">{key}:</span> {value}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMetadata(key)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 버튼들 */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리중...' : isEditing ? '수정' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MCPServerForm;

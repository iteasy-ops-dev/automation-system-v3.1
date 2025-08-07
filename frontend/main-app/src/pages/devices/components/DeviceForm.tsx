/**
 * Device Form Component
 * 
 * 장비 추가/수정을 위한 폼 컴포넌트
 * 실제 장비 연결 정보 포함 (IP, 프로토콜, 인증 정보 등)
 */

import React, { useState, useEffect } from 'react';
import { Device, DeviceFormData, DeviceCreateRequest, DeviceUpdateRequest, ConnectionProtocol } from '@/types';

interface DeviceFormProps {
  device?: Device | null;
  onSubmit: (data: DeviceCreateRequest | DeviceUpdateRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const deviceTypes = [
  { value: 'server', label: '서버' },
  { value: 'network', label: '네트워크 장비' },
  { value: 'storage', label: '스토리지' },
  { value: 'iot', label: 'IoT 장비' },
];

const connectionProtocols: { value: ConnectionProtocol; label: string; defaultPort: number }[] = [
  { value: 'ssh', label: 'SSH', defaultPort: 22 },
  { value: 'telnet', label: 'Telnet', defaultPort: 23 },
  { value: 'http', label: 'HTTP', defaultPort: 80 },
  { value: 'https', label: 'HTTPS', defaultPort: 443 },
  { value: 'snmp', label: 'SNMP', defaultPort: 161 },
];

const initialFormData: DeviceFormData = {
  name: '',
  type: 'server',
  groupId: '',
  tags: [],
  metadata: {},
  connectionInfo: {
    protocol: 'ssh',
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKey: '',
    timeout: 30,
    retryAttempts: 3,
    enableSudo: false,
    sudoPassword: '',
  },
};

export const DeviceForm: React.FC<DeviceFormProps> = ({
  device,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<DeviceFormData>(initialFormData);
  const [tagInput, setTagInput] = useState('');
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [usePrivateKey, setUsePrivateKey] = useState(false);

  const isEditing = !!device;

  // 편집 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name,
        type: device.type,
        groupId: device.groupId || '',
        tags: device.tags || [],
        metadata: (device.metadata as Record<string, string>) || {},
        connectionInfo: {
          protocol: device.connectionInfo?.protocol || 'ssh',
          host: device.connectionInfo?.host || '',
          port: device.connectionInfo?.port || 22,
          username: device.connectionInfo?.username || '',
          // 마스킹된 비밀번호는 빈 문자열로 설정 (사용자가 새로 입력해야 함)
          password: '',
          privateKey: '',
          timeout: device.connectionInfo?.timeout || 30,
          retryAttempts: device.connectionInfo?.retryAttempts || 3,
          enableSudo: device.connectionInfo?.enableSudo || false,
          sudoPassword: '',
        },
      });
      // privateKey가 마스킹되어 있으면 SSH 키 사용 모드로 설정
      setUsePrivateKey(device.connectionInfo?.privateKey === '*** (SSH Key Present) ***');
    } else {
      setFormData(initialFormData);
    }
  }, [device]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '장비명을 입력해주세요.';
    }

    if (!formData.type) {
      newErrors.type = '장비 타입을 선택해주세요.';
    }

    if (!formData.connectionInfo.host.trim()) {
      newErrors.host = 'IP 주소 또는 호스트명을 입력해주세요.';
    }

    if (!formData.connectionInfo.port || formData.connectionInfo.port < 1 || formData.connectionInfo.port > 65535) {
      newErrors.port = '유효한 포트 번호를 입력해주세요. (1-65535)';
    }

    if (formData.connectionInfo.protocol === 'ssh' || formData.connectionInfo.protocol === 'telnet') {
      if (!formData.connectionInfo.username.trim()) {
        newErrors.username = '접속 계정을 입력해주세요.';
      }

      // 수정 모드가 아닐 때만 비밀번호 필수
      if (!isEditing && !usePrivateKey && !formData.connectionInfo.password.trim()) {
        newErrors.password = '비밀번호를 입력해주세요.';
      }

      // 수정 모드가 아닐 때만 privateKey 필수
      if (!isEditing && usePrivateKey && !formData.connectionInfo.privateKey?.trim()) {
        newErrors.privateKey = 'SSH 개인키를 입력해주세요.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProtocolChange = (protocol: ConnectionProtocol) => {
    const protocolConfig = connectionProtocols.find(p => p.value === protocol);
    setFormData({
      ...formData,
      connectionInfo: {
        ...formData.connectionInfo,
        protocol,
        port: protocolConfig?.defaultPort || formData.connectionInfo.port,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const submitData: any = {
        name: formData.name,
        type: formData.type,
        groupId: formData.groupId || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        metadata: Object.keys(formData.metadata).length > 0 ? formData.metadata : undefined,
        connectionInfo: {
          protocol: formData.connectionInfo.protocol,
          host: formData.connectionInfo.host,
          port: formData.connectionInfo.port,
          username: formData.connectionInfo.username,
          timeout: formData.connectionInfo.timeout,
          retryAttempts: formData.connectionInfo.retryAttempts,
          enableSudo: formData.connectionInfo.enableSudo,
        },
      };

      // 수정 모드에서는 비밀번호가 입력된 경우에만 전송
      if (!isEditing || formData.connectionInfo.password) {
        submitData.connectionInfo.password = formData.connectionInfo.password;
      }

      // SSH 키 사용 시
      if (usePrivateKey && formData.connectionInfo.privateKey) {
        submitData.connectionInfo.privateKey = formData.connectionInfo.privateKey;
      }

      // sudo 비밀번호
      if (formData.connectionInfo.enableSudo && formData.connectionInfo.sudoPassword) {
        submitData.connectionInfo.sudoPassword = formData.connectionInfo.sudoPassword;
      }

      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    });
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {isEditing ? '장비 정보 수정' : '새 장비 등록'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* 기본 정보 섹션 */}
        <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">기본 정보</h4>
          
          {/* 장비명 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                장비명 *
              </label>
              <input
                id="device-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                placeholder="예: web-server-01"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
              )}
            </div>

            {/* 장비 타입 */}
            <div>
              <label htmlFor="device-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                장비 타입 *
              </label>
              <select
                id="device-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.type 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              >
                {deviceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.type}</p>
              )}
            </div>
          </div>
        </div>

        {/* 연결 정보 섹션 */}
        <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">연결 정보</h4>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 프로토콜 */}
            <div>
              <label htmlFor="protocol" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                접속 프로토콜 *
              </label>
              <select
                id="protocol"
                value={formData.connectionInfo.protocol}
                onChange={(e) => handleProtocolChange(e.target.value as ConnectionProtocol)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {connectionProtocols.map((protocol) => (
                  <option key={protocol.value} value={protocol.value}>
                    {protocol.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 포트 */}
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                접속 포트 *
              </label>
              <input
                id="port"
                type="number"
                value={formData.connectionInfo.port}
                onChange={(e) => setFormData({
                  ...formData,
                  connectionInfo: {
                    ...formData.connectionInfo,
                    port: parseInt(e.target.value) || 0,
                  },
                })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.port 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                min="1"
                max="65535"
              />
              {errors.port && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.port}</p>
              )}
            </div>
          </div>

          {/* IP 주소 */}
          <div>
            <label htmlFor="host" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              IP 주소 또는 호스트명 *
            </label>
            <input
              id="host"
              type="text"
              value={formData.connectionInfo.host}
              onChange={(e) => setFormData({
                ...formData,
                connectionInfo: {
                  ...formData.connectionInfo,
                  host: e.target.value,
                },
              })}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                errors.host 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              placeholder="예: 192.168.1.100 또는 server.example.com"
            />
            {errors.host && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.host}</p>
            )}
          </div>

          {/* SSH/Telnet 인증 정보 */}
          {(formData.connectionInfo.protocol === 'ssh' || formData.connectionInfo.protocol === 'telnet') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {/* 사용자명 */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    접속 계정 *
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={formData.connectionInfo.username}
                    onChange={(e) => setFormData({
                      ...formData,
                      connectionInfo: {
                        ...formData.connectionInfo,
                        username: e.target.value,
                      },
                    })}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.username 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                    placeholder="예: admin"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
                  )}
                </div>

                {/* 타임아웃 */}
                <div>
                  <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    연결 타임아웃 (초)
                  </label>
                  <input
                    id="timeout"
                    type="number"
                    value={formData.connectionInfo.timeout}
                    onChange={(e) => setFormData({
                      ...formData,
                      connectionInfo: {
                        ...formData.connectionInfo,
                        timeout: parseInt(e.target.value) || 30,
                      },
                    })}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min="1"
                    max="300"
                  />
                </div>
              </div>

              {/* SSH 인증 방식 선택 (SSH만) */}
              {formData.connectionInfo.protocol === 'ssh' && (
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
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">SSH 키</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 비밀번호 또는 SSH 키 */}
              {!usePrivateKey ? (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    비밀번호 {!isEditing && '*'}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.connectionInfo.password}
                      onChange={(e) => setFormData({
                        ...formData,
                        connectionInfo: {
                          ...formData.connectionInfo,
                          password: e.target.value,
                        },
                      })}
                      className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.password 
                          ? 'border-red-300 dark:border-red-600' 
                          : 'border-gray-300 dark:border-gray-600'
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                      placeholder={isEditing ? "새 비밀번호 입력 (변경하지 않으려면 비워두세요)" : "비밀번호 입력"}
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
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSH 개인키 {!isEditing && '*'}
                  </label>
                  <textarea
                    id="privateKey"
                    value={formData.connectionInfo.privateKey}
                    onChange={(e) => setFormData({
                      ...formData,
                      connectionInfo: {
                        ...formData.connectionInfo,
                        privateKey: e.target.value,
                      },
                    })}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.privateKey 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm`}
                    rows={4}
                    placeholder={isEditing ? "새 SSH 키 입력 (변경하지 않으려면 비워두세요)" : "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                  />
                  {errors.privateKey && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.privateKey}</p>
                  )}
                </div>
              )}

              {/* sudo 설정 */}
              <div className="space-y-2">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.connectionInfo.enableSudo}
                    onChange={(e) => setFormData({
                      ...formData,
                      connectionInfo: {
                        ...formData.connectionInfo,
                        enableSudo: e.target.checked,
                      },
                    })}
                    className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">sudo 권한 필요</span>
                </label>

                {formData.connectionInfo.enableSudo && (
                  <div>
                    <label htmlFor="sudoPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      sudo 비밀번호
                    </label>
                    <input
                      id="sudoPassword"
                      type="password"
                      value={formData.connectionInfo.sudoPassword}
                      onChange={(e) => setFormData({
                        ...formData,
                        connectionInfo: {
                          ...formData.connectionInfo,
                          sudoPassword: e.target.value,
                        },
                      })}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder={isEditing ? "새 sudo 비밀번호 (변경하지 않으려면 비워두세요)" : "사용자 비밀번호와 다른 경우 입력"}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 추가 정보 섹션 */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">추가 정보</h4>
          
          {/* 그룹 ID */}
          <div>
            <label htmlFor="device-group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              그룹 ID
            </label>
            <input
              id="device-group"
              type="text"
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="선택사항"
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              태그
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="태그 입력 후 추가 버튼 클릭"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                추가
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
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

export default DeviceForm;

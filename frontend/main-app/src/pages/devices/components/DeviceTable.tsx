/**
 * Device Table Component
 * 
 * 장비 목록을 테이블 형태로 표시하는 컴포넌트
 * 연결 정보 포함
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Device, DeviceSort } from '@/types';
import { DeviceStatusBadge } from './DeviceStatusBadge';

interface DeviceTableProps {
  devices: Device[];
  loading: boolean;
  sort: DeviceSort;
  onSortChange: (sort: DeviceSort) => void;
  onDeviceClick: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onTestConnection?: (device: Device) => void;
  className?: string;
}

const typeLabels: Record<string, string> = {
  server: '서버',
  network: '네트워크',
  storage: '스토리지',
  iot: 'IoT',
};

const protocolLabels: Record<string, string> = {
  ssh: 'SSH',
  telnet: 'Telnet',
  http: 'HTTP',
  https: 'HTTPS',
  snmp: 'SNMP',
};

export const DeviceTable: React.FC<DeviceTableProps> = ({
  devices,
  loading,
  sort,
  onSortChange,
  onDeviceClick,
  onEditDevice,
  onDeleteDevice,
  onTestConnection,
  className = '',
}) => {
  const handleSort = (field: DeviceSort['field']) => {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ field, direction });
  };

  const getSortIcon = (field: DeviceSort['field']) => {
    if (sort.field !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sort.direction === 'asc' ? (
      <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">장비 목록을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">장비가 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            새로운 장비를 등록하여 시작하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>장비명</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center space-x-1">
                  <span>타입</span>
                  {getSortIcon('type')}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                연결 정보
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>상태</span>
                  {getSortIcon('status')}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                태그
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center space-x-1">
                  <span>등록일</span>
                  {getSortIcon('createdAt')}
                </div>
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {devices.map((device) => (
              <tr
                key={device.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onDeviceClick(device)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {device.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {device.id.slice(0, 8)}...
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {typeLabels[device.type] || device.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {device.connectionInfo ? (
                    <div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {protocolLabels[device.connectionInfo.protocol] || device.connectionInfo.protocol} 
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          ({device.connectionInfo.host}:{device.connectionInfo.port})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {device.connectionInfo.username || '-'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                      연결 정보 없음
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DeviceStatusBadge status={device.status as any} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {device.tags?.slice(0, 2).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        {tag}
                      </span>
                    ))}
                    {device.tags && device.tags.length > 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        +{device.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true, locale: ko })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                    {device.connectionInfo && onTestConnection && (
                      <button
                        onClick={() => onTestConnection(device)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        title="연결 테스트"
                      >
                        테스트
                      </button>
                    )}
                    <button
                      onClick={() => onEditDevice(device)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => onDeleteDevice(device)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeviceTable;

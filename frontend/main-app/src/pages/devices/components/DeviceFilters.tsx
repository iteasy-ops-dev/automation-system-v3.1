/**
 * Device Filters Component
 * 
 * 장비 목록 필터링 UI
 */

import React from 'react';
import type { DeviceFilters as DeviceFiltersType, DeviceType } from '@/types';

interface DeviceFiltersProps {
  filters: DeviceFiltersType;
  onFiltersChange: (filters: DeviceFiltersType) => void;
  className?: string;
}

const deviceTypes: { value: DeviceType; label: string }[] = [
  { value: 'server', label: '서버' },
  { value: 'network', label: '네트워크' },
  { value: 'storage', label: '스토리지' },
  { value: 'iot', label: 'IoT' },
];

const statusOptions = [
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' },
  { value: 'maintenance', label: '점검중' },
];

export const DeviceFilters: React.FC<DeviceFiltersProps> = ({
  filters,
  onFiltersChange,
  className = '',
}) => {
  const handleFilterChange = (key: keyof DeviceFiltersType, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
      offset: 0, // 필터 변경 시 첫 페이지로
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange('search', e.target.value);
  };

  const clearFilters = () => {
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
    });
  };

  const hasActiveFilters = filters.search || filters.type || filters.status;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* 검색 */}
        <div className="flex-1 min-w-0">
          <label htmlFor="device-search" className="sr-only">
            장비 검색
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              id="device-search"
              type="text"
              placeholder="장비명으로 검색..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* 타입 필터 */}
        <div className="flex-shrink-0">
          <label htmlFor="device-type" className="sr-only">
            장비 타입
          </label>
          <select
            id="device-type"
            value={filters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">모든 타입</option>
            {deviceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* 상태 필터 */}
        <div className="flex-shrink-0">
          <label htmlFor="device-status" className="sr-only">
            장비 상태
          </label>
          <select
            id="device-status"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">모든 상태</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* 필터 초기화 */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex-shrink-0 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            초기화
          </button>
        )}
      </div>
    </div>
  );
};

export default DeviceFilters;

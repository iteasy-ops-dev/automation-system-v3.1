/**
 * Devices Page - 장비 관리 페이지
 * 
 * 실제 백엔드 API와 연동하여 장비 목록 관리
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { 
  Device, 
  DeviceFilters as DeviceFiltersType, 
  DeviceSort, 
  DeviceCreateRequest, 
  DeviceUpdateRequest 
} from '@/types';
import { deviceService } from '@/services';

// Components
import DeviceTable from './components/DeviceTable';
import DeviceFilters from './components/DeviceFilters';
import DeviceForm from './components/DeviceForm';
import ConnectionTestModal from './components/ConnectionTestModal';

interface DevicesPageProps {
  className?: string;
}

const DEVICES_QUERY_KEY = 'devices';

export const DevicesPage: React.FC<DevicesPageProps> = ({ className = '' }) => {
  const queryClient = useQueryClient();
  
  // Local state
  const [filters, setFilters] = useState<DeviceFiltersType>({
    limit: 20,
    offset: 0,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [sort, setSort] = useState<DeviceSort>({
    field: 'createdAt',
    direction: 'desc',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [testingDevice, setTestingDevice] = useState<Device | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  // Remove unused selectedDevice state

  // Query: 장비 목록 조회
  const {
    data: devicesResponse,
    isLoading: devicesLoading,
    error: devicesError,
  } = useQuery({
    queryKey: [DEVICES_QUERY_KEY, filters],
    queryFn: () => deviceService.getDevices(filters),
    keepPreviousData: true,
  });

  // Mutation: 장비 생성
  const createDeviceMutation = useMutation({
    mutationFn: (data: DeviceCreateRequest) => deviceService.createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries([DEVICES_QUERY_KEY]);
      setShowForm(false);
      toast.success('장비가 성공적으로 등록되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '장비 등록에 실패했습니다.');
    },
  });

  // Mutation: 장비 수정
  const updateDeviceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeviceUpdateRequest }) => 
      deviceService.updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries([DEVICES_QUERY_KEY]);
      setEditingDevice(null);
      setShowForm(false);
      toast.success('장비 정보가 성공적으로 수정되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '장비 수정에 실패했습니다.');
    },
  });

  // Mutation: 장비 삭제
  const deleteDeviceMutation = useMutation({
    mutationFn: (id: string) => deviceService.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries([DEVICES_QUERY_KEY]);
      toast.success('장비가 성공적으로 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error(error.message || '장비 삭제에 실패했습니다.');
    },
  });

  // Error handling
  useEffect(() => {
    if (devicesError) {
      toast.error('장비 목록을 불러오는데 실패했습니다.');
    }
  }, [devicesError]);

  // Handlers
  const handleFiltersChange = (newFilters: DeviceFiltersType) => {
    setFilters(newFilters);
  };

  const handleSortChange = (newSort: DeviceSort) => {
    setSort(newSort);
    setFilters({
      ...filters,
      sortBy: newSort.field === 'type' ? 'createdAt' : newSort.field, // type은 지원되지 않으므로 createdAt으로 대체
      sortOrder: newSort.direction,
      offset: 0,
    });
  };

  const handleDeviceClick = (device: Device) => {
    // TODO: 상세 모달 또는 상세 페이지로 이동
    console.log('Device clicked:', device);
  };

  const handleCreateDevice = () => {
    setEditingDevice(null);
    setShowForm(true);
  };

  const handleEditDevice = async (device: Device) => {
    try {
      // 장비 상세 정보를 다시 가져옴
      const fullDeviceInfo = await deviceService.getDevice(device.id);
      setEditingDevice(fullDeviceInfo);
      setShowForm(true);
    } catch (error: any) {
      console.error('Failed to fetch device details:', error);
      toast.error('장비 정보를 가져오는데 실패했습니다.');
      // 실패 시에도 기본 정보로 폼을 열어줌
      setEditingDevice(device);
      setShowForm(true);
    }
  };
  
  const handleTestConnection = (device: Device) => {
    setTestingDevice(device);
    setShowTestModal(true);
  };

  const handleDeleteDevice = async (device: Device) => {
    if (window.confirm(`'${device.name}' 장비를 정말 삭제하시겠습니까?`)) {
      deleteDeviceMutation.mutate(device.id);
    }
  };

  const handleFormSubmit = async (data: DeviceCreateRequest | DeviceUpdateRequest) => {
    if (editingDevice) {
      // 수정
      updateDeviceMutation.mutate({
        id: editingDevice.id,
        data: data as DeviceUpdateRequest,
      });
    } else {
      // 생성
      createDeviceMutation.mutate(data as DeviceCreateRequest);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingDevice(null);
  };

  const handlePageChange = (newOffset: number) => {
    setFilters({
      ...filters,
      offset: newOffset,
    });
  };

  const devices = devicesResponse?.items || [];
  const total = devicesResponse?.total || 0;
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;
  const totalPages = Math.ceil(total / (filters.limit || 20));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">장비 관리</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            시스템에 등록된 장비를 관리합니다. 총 {total}개의 장비가 등록되어 있습니다.
          </p>
        </div>
        <button
          onClick={handleCreateDevice}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          장비 추가
        </button>
      </div>

      {/* 통계 카드 (간단한 요약) */}
      {devicesResponse && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    전체 장비
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
                    활성 장비
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {devices.filter(d => d.status === 'active').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    점검중
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {devices.filter(d => d.status === 'maintenance').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    비활성
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {devices.filter(d => d.status === 'inactive').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상태 설명 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">장비 상태 안내</h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium">활성</span>: 장비가 등록되어 있고 관리 대상입니다.</li>
                <li><span className="font-medium">비활성</span>: 장비가 일시적으로 관리에서 제외되었습니다.</li>
                <li><span className="font-medium">점검중</span>: 장비가 유지보수 중입니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <DeviceFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* 장비 테이블 */}
      <DeviceTable
        devices={devices}
        loading={devicesLoading}
        sort={sort}
        onSortChange={handleSortChange}
        onDeviceClick={handleDeviceClick}
        onEditDevice={handleEditDevice}
        onDeleteDevice={handleDeleteDevice}
        onTestConnection={handleTestConnection}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 rounded-lg">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(Math.max(0, (filters.offset || 0) - (filters.limit || 20)))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <button
              onClick={() => handlePageChange((filters.offset || 0) + (filters.limit || 20))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                총 <span className="font-medium">{total}</span>개 중{' '}
                <span className="font-medium">{(filters.offset || 0) + 1}</span>-
                <span className="font-medium">
                  {Math.min((filters.offset || 0) + (filters.limit || 20), total)}
                </span>
                번째 항목
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(Math.max(0, (filters.offset || 0) - (filters.limit || 20)))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange((filters.offset || 0) + (filters.limit || 20))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* 장비 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <DeviceForm
                device={editingDevice}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                loading={createDeviceMutation.isLoading || updateDeviceMutation.isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* 연결 테스트 모달 */}
      <ConnectionTestModal
        device={testingDevice}
        isOpen={showTestModal}
        onClose={() => {
          setShowTestModal(false);
          setTestingDevice(null);
        }}
      />
    </div>
  );
};

export default DevicesPage;

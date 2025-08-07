/**
 * Device Connection Test Modal
 * 
 * 장비 연결 테스트를 수행하고 결과를 표시하는 모달
 */

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Device } from '@/types';
import { deviceService } from '@/services/device';

interface ConnectionTestModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionTestModal: React.FC<ConnectionTestModalProps> = ({
  device,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  if (!isOpen || !device) return null;

  const runConnectionTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // 실제 API 호출
      const response = await deviceService.testConnection(device.id);
      
      setTestResult({
        success: response.success,
        message: response.success 
          ? `${device.name}에 성공적으로 연결되었습니다.`
          : `${device.name}에 연결할 수 없습니다.`,
        details: response.success 
          ? {
              responseTime: response.responseTime,
              serverInfo: response.details?.serverInfo,
              uptime: response.details?.uptime,
              ...response.details
            }
          : {
              error: response.error,
              errorCode: response.errorCode,
              suggestion: getErrorSuggestion(response.errorCode || ''),
              responseTime: response.responseTime
            }
      });

      // 연결 테스트 완료 후 장비 목록 캐시 갱신
      await queryClient.invalidateQueries(['devices']);
      
    } catch (error: any) {
      setTestResult({
        success: false,
        message: '연결 테스트 중 오류가 발생했습니다.',
        details: { error: error?.message || 'Unknown error' }
      });
    } finally {
      setTesting(false);
    }
  };

  const getErrorSuggestion = (errorCode: string): string => {
    const suggestions: Record<string, string> = {
      'HOST_UNREACHABLE': '네트워크 연결을 확인하세요. 호스트가 온라인 상태인지 확인하세요.',
      'SSH_AUTH_FAILED': '사용자명과 비밀번호를 확인하세요. SSH 키가 올바른지 확인하세요.',
      'SSH_CONNECTION_REFUSED': 'SSH 서비스가 실행 중인지 확인하세요. 포트 번호가 올바른지 확인하세요.',
      'SSH_TIMEOUT': '네트워크 지연이 발생했습니다. 방화벽 설정을 확인하세요.',
      'HTTP_CONNECTION_REFUSED': 'HTTP 서비스가 실행 중인지 확인하세요. 포트 번호가 올바른지 확인하세요.',
      'HTTP_AUTH_FAILED': '인증 정보를 확인하세요.',
      'HTTP_TIMEOUT': '응답 시간이 초과되었습니다. 서버 상태를 확인하세요.',
      'SNMP_TIMEOUT': 'SNMP 서비스가 활성화되어 있는지 확인하세요. Community 문자열을 확인하세요.',
      'UNSUPPORTED_PROTOCOL': '지원되지 않는 프로토콜입니다. SSH, HTTP, HTTPS, SNMP만 지원됩니다.'
    };
    
    return suggestions[errorCode] || '네트워크 연결 및 설정을 확인하세요.';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
              장비 연결 테스트
            </h3>

            {/* 장비 정보 */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">테스트 대상</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">장비명:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">{device.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">프로토콜:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {device.connectionInfo?.protocol?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">주소:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {device.connectionInfo?.host}:{device.connectionInfo?.port}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">사용자:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {device.connectionInfo?.username || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* 테스트 버튼 */}
            {!testResult && !testing && (
              <button
                onClick={runConnectionTest}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                연결 테스트 시작
              </button>
            )}

            {/* 테스트 중 */}
            {testing && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">연결 테스트 중...</p>
              </div>
            )}

            {/* 테스트 결과 */}
            {testResult && !testing && (
              <div className={`p-4 rounded-lg ${
                testResult.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {testResult.success ? (
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <h4 className={`text-sm font-medium ${
                      testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}>
                      {testResult.message}
                    </h4>
                    {testResult.details && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {testResult.success ? (
                          <>
                            <div>응답 시간: {testResult.details.responseTime}ms</div>
                            <div>서버 정보: {testResult.details.serverInfo}</div>
                            <div>가동 시간: {testResult.details.uptime}</div>
                          </>
                        ) : (
                          <>
                            <div>오류: {testResult.details.error}</div>
                            {testResult.details.errorCode && (
                              <div>오류 코드: {testResult.details.errorCode}</div>
                            )}
                            {testResult.details.suggestion && (
                              <div className="mt-1">{testResult.details.suggestion}</div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 다시 테스트 버튼 */}
                <button
                  onClick={runConnectionTest}
                  className="mt-4 w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  다시 테스트
                </button>
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionTestModal;

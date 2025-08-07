/**
 * Provider Form Component - Part 1
 * LLM 프로바이더 추가/편집 폼
 */

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Info } from 'lucide-react';
import { llmService } from '@/services/llm.service';
import {
  LLMProvider,
  LLMProviderType,
  LLMPurpose,
  CreateProviderDto,
  UpdateProviderDto,
  providerConfigs,
  LLMProviderConfig
} from '@/types/llm';

interface ProviderFormProps {
  provider?: LLMProvider | null;
  onClose: () => void;
}

export function ProviderForm({ provider, onClose }: ProviderFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'openai' as LLMProviderType,
    purpose: 'both' as LLMPurpose,
    config: {
      apiKey: '',
      baseUrl: '',
      organization: '',
      authType: 'bearer' as 'bearer' | 'basic' | 'custom' | 'none',
      customHeaders: {} as Record<string, string>,
      timeout: 30000
    } as LLMProviderConfig,
    models: [] as string[],
    isActive: true
  });

  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [customHeaderKey, setCustomHeaderKey] = useState('');
  const [customHeaderValue, setCustomHeaderValue] = useState('');

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name,
        type: provider.type,
        purpose: provider.purpose,
        config: provider.config,
        models: provider.models || [],  // 이미 문자열 배열이므로 그대로 사용
        isActive: provider.isActive
      });
    } else {
      // 타입에 따른 기본값 설정
      const config = providerConfigs[formData.type];
      if (config && config.baseUrl) {
        setFormData(prev => ({
          ...prev,
          config: { ...prev.config, baseUrl: config.baseUrl }
        }));
      }
    }
  }, [provider]);

  const handleTypeChange = (type: LLMProviderType) => {
    const config = providerConfigs[type];
    setFormData(prev => ({
      ...prev,
      type,
      config: {
        ...prev.config,
        baseUrl: config.baseUrl || prev.config.baseUrl
      },
      models: config.defaultModels || []
    }));
  };

  const handleAddCustomHeader = () => {
    if (customHeaderKey && customHeaderValue) {
      setFormData(prev => ({
        ...prev,
        config: {
          ...prev.config,
          customHeaders: {
            ...prev.config.customHeaders,
            [customHeaderKey]: customHeaderValue
          }
        }
      }));
      setCustomHeaderKey('');
      setCustomHeaderValue('');
    }
  };

  const handleRemoveCustomHeader = (key: string) => {
    setFormData(prev => {
      const headers = { ...prev.config.customHeaders };
      delete headers[key];
      return {
        ...prev,
        config: { ...prev.config, customHeaders: headers }
      };
    });
  };

  const handleDiscoverModels = async () => {
    if (!provider?.id) return;
    
    try {
      setDiscovering(true);
      const models = await llmService.discoverModels(provider.id);
      setFormData(prev => ({
        ...prev,
        models: models.map(m => m.id)
      }));
    } catch (err) {
      console.error('Failed to discover models:', err);
      alert('모델 탐색에 실패했습니다.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 모델 검증
    if (formData.models.length === 0 && !isCustom) {
      alert('최소 1개 이상의 모델을 선택해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      
      if (provider) {
        const updates: UpdateProviderDto = {
          name: formData.name,
          purpose: formData.purpose,
          config: formData.config,
          models: formData.models,  // models 추가!
          isActive: formData.isActive
        };
        await llmService.updateProvider(provider.id, updates);
      } else {
        const newProvider: CreateProviderDto = {
          name: formData.name,
          type: formData.type,
          purpose: formData.purpose,
          config: formData.config,
          models: formData.models
        };
        await llmService.createProvider(newProvider);
      }
      
      onClose();
    } catch (err) {
      console.error('Failed to save provider:', err);
      alert('프로바이더 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const config = providerConfigs[formData.type];
  const isCustom = formData.type === 'custom' || formData.type === 'ollama';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {provider ? '프로바이더 편집' : '프로바이더 추가'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">기본 정보</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>

            {!provider && (
              <div>
                <label className="block text-sm font-medium mb-2">타입</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value as LLMProviderType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">용도</label>
              <select
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value as LLMPurpose }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="chat">Chat 전용</option>
                <option value="workflow">Workflow 전용</option>
                <option value="both">Chat & Workflow</option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Chat: 사용자 대화, Workflow: 시스템 작업 처리
              </p>
            </div>
          </div>

          {/* 연결 설정 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">연결 설정</h3>
            
            {config.fields.includes('apiKey') && (
              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="password"
                  value={formData.config.apiKey || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, apiKey: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required={!isCustom}
                />
              </div>
            )}

            {(isCustom || config.fields.includes('baseUrl')) && (
              <div>
                <label className="block text-sm font-medium mb-2">Base URL</label>
                <input
                  type="url"
                  value={formData.config.baseUrl || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, baseUrl: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required={isCustom}
                />
              </div>
            )}

            {config.fields.includes('organization') && (
              <div>
                <label className="block text-sm font-medium mb-2">Organization (선택)</label>
                <input
                  type="text"
                  value={formData.config.organization || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, organization: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
            )}

            {isCustom && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">인증 타입</label>
                  <select
                    value={formData.config.authType}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, authType: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="custom">Custom Headers</option>
                    <option value="none">None</option>
                  </select>
                </div>

                {/* Custom Headers */}
                {formData.config.authType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Custom Headers</label>
                    <div className="space-y-2">
                      {Object.entries(formData.config.customHeaders || {}).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <input
                            type="text"
                            value={key}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600"
                            disabled
                          />
                          <input
                            type="text"
                            value={value}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600"
                            disabled
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomHeader(key)}
                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Header Key"
                          value={customHeaderKey}
                          onChange={(e) => setCustomHeaderKey(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                        <input
                          type="text"
                          placeholder="Header Value"
                          value={customHeaderValue}
                          onChange={(e) => setCustomHeaderValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomHeader}
                          className="p-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 모델 선택 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">모델 선택</h3>
              {provider && config.requiresModelDiscovery && (
                <button
                  type="button"
                  onClick={handleDiscoverModels}
                  disabled={discovering}
                  className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {discovering ? '탐색 중...' : '모델 자동 탐색'}
                </button>
              )}
            </div>

            {/* OpenAI, Anthropic, Google의 경우 - 기본 모델 + 선택된 모델 통합 표시 */}
            {!isCustom && config.defaultModels && (
              <div className="space-y-2">
                {/* 모든 가능한 모델 목록 생성 (기본 모델 + 현재 선택된 모델) */}
                {(() => {
                  const allPossibleModels = new Set([
                    ...(config.defaultModels || []),
                    ...formData.models
                  ]);
                  
                  return Array.from(allPossibleModels).map(model => (
                    <label key={model} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.models.includes(model)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              models: [...prev.models, model]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              models: prev.models.filter(m => m !== model)
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {model}
                        {/* 기본 모델인지 표시 */}
                        {config.defaultModels?.includes(model) && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            기본
                          </span>
                        )}
                        {/* 현재 선택되었지만 기본이 아닌 모델 표시 */}
                        {!config.defaultModels?.includes(model) && (
                          <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            커스텀
                          </span>
                        )}
                      </span>
                    </label>
                  ));
                })()}
                
                {/* 모델이 없는 경우 안내 */}
                {formData.models.length === 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    ⚠️ 최소 1개 이상의 모델을 선택해주세요.
                  </p>
                )}
              </div>
            )}

            {/* Custom/Ollama의 경우 */}
            {isCustom && (
              <div className="space-y-3">
                {/* 현재 선택된 모델들 표시 */}
                {formData.models.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">선택된 모델:</p>
                    {formData.models.map(model => (
                      <div key={model} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-sm">{model}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              models: prev.models.filter(m => m !== model)
                            }));
                          }}
                          className="text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 안내 메시지 */}
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <Info className="w-4 h-4 inline mr-1" />
                    {provider ? 
                      '프로바이더를 저장한 후 "모델 자동 탐색" 버튼을 사용하여 사용 가능한 모델을 자동으로 발견할 수 있습니다.' :
                      '커스텀 프로바이더의 경우 저장 후 모델 자동 탐색을 사용하세요.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 활성화 설정 */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <span className="font-medium">활성화</span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              비활성화된 프로바이더는 사용할 수 없습니다.
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '저장 중...' : provider ? '수정' : '추가'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * LLM Management Page - 이원화된 LLM 관리
 * Chat용과 Workflow용 LLM을 독립적으로 관리
 */

import { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  AlertCircle,
  Activity,
  Zap
} from 'lucide-react';
import { llmService } from '@/services/llm.service';
import { LLMProvider, LLMPurpose } from '@/types/llm';
import { ProviderForm } from './components/ProviderForm';
import { ProviderCard } from './components/ProviderCard';
import { UsageStats } from './components/UsageStats';

export function LLMManagementPage() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [activeTab, setActiveTab] = useState<'providers' | 'usage'>('providers');

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await llmService.getProviders();
      // 배열인지 확인하고 안전하게 설정
      setProviders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load LLM providers');
      console.error(err);
      // 에러 시에도 빈 배열로 설정
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = () => {
    setShowAddForm(true);
    setEditingProvider(null);
  };

  const handleEditProvider = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setShowAddForm(true);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('정말로 이 프로바이더를 삭제하시겠습니까?')) return;

    try {
      await llmService.deleteProvider(id);
      await loadProviders();
    } catch (err) {
      console.error('Failed to delete provider:', err);
      alert('프로바이더 삭제에 실패했습니다.');
    }
  };

  const handleSetDefault = async (providerId: string, purpose: LLMPurpose) => {
    try {
      await llmService.setDefaultProvider(purpose, providerId);
      await loadProviders();
    } catch (err) {
      console.error('Failed to set default provider:', err);
      alert('기본 프로바이더 설정에 실패했습니다.');
    }
  };

  const handleTestProvider = async (providerId: string) => {
    try {
      const result = await llmService.testProvider(providerId);
      if (result.success) {
        alert(`연결 테스트 성공! (${result.latency}ms)`);
      } else {
        alert(`연결 테스트 실패: ${result.error}`);
      }
    } catch (err) {
      alert('연결 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingProvider(null);
    loadProviders();
  };

  const chatProviders = Array.isArray(providers) ? providers.filter(p => p.purpose === 'chat' || p.purpose === 'both') : [];
  const workflowProviders = Array.isArray(providers) ? providers.filter(p => p.purpose === 'workflow' || p.purpose === 'both') : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6" />
          LLM 관리
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Chat과 Workflow를 위한 이원화된 LLM 프로바이더를 관리합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'providers'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          프로바이더 관리
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'usage'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          사용량 통계
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {activeTab === 'providers' && (
        <>
          {/* Add Button */}
          <div className="mb-6">
            <button
              onClick={handleAddProvider}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              프로바이더 추가
            </button>
          </div>

          {/* Chat Providers */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Chat용 LLM
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chatProviders.map(provider => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onEdit={handleEditProvider}
                  onDelete={handleDeleteProvider}
                  onSetDefault={handleSetDefault}
                  onTest={handleTestProvider}
                />
              ))}
              {chatProviders.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                  Chat용 LLM 프로바이더가 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* Workflow Providers */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Workflow용 LLM
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflowProviders.map(provider => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onEdit={handleEditProvider}
                  onDelete={handleDeleteProvider}
                  onSetDefault={handleSetDefault}
                  onTest={handleTestProvider}
                />
              ))}
              {workflowProviders.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                  Workflow용 LLM 프로바이더가 없습니다.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'usage' && (
        <UsageStats providers={providers} />
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <ProviderForm
          provider={editingProvider}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}

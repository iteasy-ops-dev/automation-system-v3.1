/**
 * Provider Card Component
 * LLM 프로바이더 카드 표시
 */

import { LLMProvider, LLMPurpose } from '@/types/llm';
import {
  Settings,
  Trash2,
  Check,
  Star,
  Zap,
  MessageSquare,
  Globe
} from 'lucide-react';

interface ProviderCardProps {
  provider: LLMProvider;
  onEdit: (provider: LLMProvider) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string, purpose: LLMPurpose) => void;
  onTest: (id: string) => void;
}

export function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onSetDefault,
  onTest
}: ProviderCardProps) {
  const getProviderIcon = () => {
    switch (provider.type) {
      case 'openai':
        return <MessageSquare className="w-8 h-8" />;
      case 'anthropic':
        return <Zap className="w-8 h-8" />;
      case 'google':
        return <Globe className="w-8 h-8" />;
      default:
        return <MessageSquare className="w-8 h-8" />;
    }
  };

  const purposeColors = {
    chat: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    workflow: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    both: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getProviderIcon()}
          <div>
            <h3 className="font-semibold text-lg">{provider.name}</h3>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${purposeColors[provider.purpose]}`}>
              {provider.purpose === 'both' ? 'Chat & Workflow' : provider.purpose.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onTest(provider.id)}
            className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            title="연결 테스트"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(provider)}
            className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            title="편집"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(provider.id)}
            className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div>타입: {provider.type}</div>
        <div>모델: {provider.models.length}개</div>
        {provider.config.baseUrl && (
          <div className="truncate">URL: {provider.config.baseUrl}</div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {provider.isDefault.forChat && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded text-xs">
                <Star className="w-3 h-3" />
                Chat 기본
              </span>
            )}
            {provider.isDefault.forWorkflow && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded text-xs">
                <Star className="w-3 h-3" />
                Workflow 기본
              </span>
            )}
          </div>
          
          {provider.isActive ? (
            <span className="text-green-600 dark:text-green-400 text-sm">활성</span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">비활성</span>
          )}
        </div>

        {/* Default 설정 버튼 */}
        {provider.isActive && (
          <div className="mt-3 flex gap-2">
            {(provider.purpose === 'chat' || provider.purpose === 'both') && !provider.isDefault.forChat && (
              <button
                onClick={() => onSetDefault(provider.id, 'chat')}
                className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
              >
                Chat 기본으로 설정
              </button>
            )}
            {(provider.purpose === 'workflow' || provider.purpose === 'both') && !provider.isDefault.forWorkflow && (
              <button
                onClick={() => onSetDefault(provider.id, 'workflow')}
                className="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 transition-colors"
              >
                Workflow 기본으로 설정
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

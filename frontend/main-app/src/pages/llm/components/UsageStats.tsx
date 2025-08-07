/**
 * Usage Stats Component
 * LLM 사용량 통계 표시
 */

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, MessageSquare } from 'lucide-react';
import { llmService } from '@/services/llm.service';
import { LLMProvider, UsageStats as UsageStatsType } from '@/types/llm';

interface UsageStatsProps {
  providers: LLMProvider[];
}

export function UsageStats({ providers }: UsageStatsProps) {
  const [usageData, setUsageData] = useState<UsageStatsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadUsageStats();
  }, [selectedProviderId, days]);

  const loadUsageStats = async () => {
    try {
      setLoading(true);
      const data = await llmService.getUsage(selectedProviderId || undefined, days);
      setUsageData(Array.isArray(data) ? data : [data]);
    } catch (err) {
      console.error('Failed to load usage stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalStats = usageData.reduce(
    (acc, stats) => ({
      totalTokens: acc.totalTokens + (stats.totalTokens || 0),
      totalCost: acc.totalCost + (stats.totalCost || 0),
      requestCount: acc.requestCount + (stats.requestCount || 0)
    }),
    { totalTokens: 0, totalCost: 0, requestCount: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="flex gap-4 items-center">
        <select
          value={selectedProviderId || ''}
          onChange={(e) => setSelectedProviderId(e.target.value || null)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        >
          <option value="">모든 프로바이더</option>
          {providers.map(provider => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        >
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
        </select>
      </div>

      {/* 총계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">총 토큰 사용량</p>
              <p className="text-2xl font-bold">
                {totalStats.totalTokens.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">총 비용</p>
              <p className="text-2xl font-bold">
                ${totalStats.totalCost.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">총 요청 수</p>
              <p className="text-2xl font-bold">
                {totalStats.requestCount.toLocaleString()}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* 프로바이더별 상세 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-lg">프로바이더별 사용량</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 font-medium">프로바이더</th>
                  <th className="pb-3 font-medium text-right">토큰</th>
                  <th className="pb-3 font-medium text-right">비용</th>
                  <th className="pb-3 font-medium text-right">요청</th>
                  <th className="pb-3 font-medium text-right">평균 토큰/요청</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {usageData.map((stats) => (
                  <tr key={stats.providerId}>
                    <td className="py-3">{stats.providerName || 'Unknown'}</td>
                    <td className="py-3 text-right">{(stats.totalTokens || 0).toLocaleString()}</td>
                    <td className="py-3 text-right">${(stats.totalCost || 0).toFixed(2)}</td>
                    <td className="py-3 text-right">{(stats.requestCount || 0).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      {stats.requestCount > 0
                        ? Math.round((stats.totalTokens || 0) / stats.requestCount).toLocaleString()
                        : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

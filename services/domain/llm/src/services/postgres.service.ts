/**
 * PostgreSQL Service - LLM 사용량 및 프로바이더 정보 관리
 * 계약 준수: TASK-3 PostgreSQL 스키마 100% 준수
 */

import { Pool, PoolClient } from 'pg';
import { finalConfig } from '../config';
import logger from '../utils/logger';
import { LLMProviderConfig, LLMUsageLog } from '../types/contracts';

export class PostgresService {
  private pool: Pool | null = null;

  /**
   * PostgreSQL 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      this.pool = new Pool({
        host: finalConfig.databases.postgres.host,
        port: finalConfig.databases.postgres.port,
        database: finalConfig.databases.postgres.database,
        user: finalConfig.databases.postgres.username,
        password: finalConfig.databases.postgres.password,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // 연결 테스트
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      logger.info('PostgreSQL connected successfully');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * PostgreSQL 연결 종료
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('PostgreSQL disconnected');
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      return true;
    } catch (error) {
      logger.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  /**
   * 사용량 로깅
   */
  async logUsage(usage: {
    id: string;
    requestId: string;
    providerId: string;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    duration?: number;
    status: 'success' | 'error' | 'timeout';
    errorMessage?: string;
    cached: boolean;
    createdAt: Date;
  }): Promise<void> {
    try {
      if (!this.pool) {
        throw new Error('PostgreSQL not connected');
      }

      const query = `
        INSERT INTO llm_usage_logs (
          id, request_id, user_id, provider_id, model_name,
          prompt_tokens, completion_tokens, total_tokens, cost,
          duration_ms, status, error_message, cached, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      const values = [
        usage.id,
        usage.requestId,
        null, // user_id - TODO: 실제 사용자 ID 추가
        usage.providerId,
        usage.modelName,
        usage.promptTokens,
        usage.completionTokens,
        usage.totalTokens,
        usage.cost,
        usage.duration,
        usage.status,
        usage.errorMessage,
        usage.cached,
        usage.createdAt,
      ];

      await this.pool.query(query, values);
      logger.debug('Usage logged:', { requestId: usage.requestId });
    } catch (error) {
      logger.error('Failed to log usage:', error);
      throw error;
    }
  }

  /**
   * 사용량 통계 조회
   */
  async getUsageStats(filters: {
    startDate: Date;
    endDate: Date;
    provider?: string;
    model?: string;
    groupBy: 'provider' | 'model' | 'user' | 'hour' | 'day';
  }): Promise<any> {
    try {
      if (!this.pool) {
        throw new Error('PostgreSQL not connected');
      }

      // 기본 쿼리 구성
      let whereClause = 'WHERE created_at >= $1 AND created_at <= $2';
      const values: any[] = [filters.startDate, filters.endDate];
      let paramIndex = 3;

      if (filters.provider) {
        whereClause += ` AND provider_id = $${paramIndex}`;
        values.push(filters.provider);
        paramIndex++;
      }

      if (filters.model) {
        whereClause += ` AND model_name = $${paramIndex}`;
        values.push(filters.model);
        paramIndex++;
      }

      // 요약 통계
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_requests,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(duration_ms) as avg_response_time
        FROM llm_usage_logs 
        ${whereClause}
      `;

      const summaryResult = await this.pool.query(summaryQuery, values);
      const summary = summaryResult.rows[0];

      // 상세 분석 (groupBy에 따라)
      let groupByClause = '';
      switch (filters.groupBy) {
        case 'provider':
          groupByClause = 'provider_id';
          break;
        case 'model':
          groupByClause = 'model_name';
          break;
        case 'day':
          groupByClause = 'DATE(created_at)';
          break;
        case 'hour':
          groupByClause = 'DATE_TRUNC(\'hour\', created_at)';
          break;
        default:
          groupByClause = 'provider_id';
      }

      const detailQuery = `
        SELECT 
          ${groupByClause} as group_key,
          COUNT(*) as requests,
          SUM(prompt_tokens) as input_tokens,
          SUM(completion_tokens) as output_tokens,
          SUM(cost) as cost,
          AVG(duration_ms) as avg_response_time
        FROM llm_usage_logs 
        ${whereClause}
        GROUP BY ${groupByClause}
        ORDER BY requests DESC
      `;

      const detailResult = await this.pool.query(detailQuery, values);

      return {
        period: {
          start: filters.startDate.toISOString(),
          end: filters.endDate.toISOString(),
        },
        summary: {
          totalRequests: parseInt(summary.total_requests) || 0,
          totalTokens: parseInt(summary.total_tokens) || 0,
          totalCost: parseFloat(summary.total_cost) || 0,
          avgResponseTime: parseFloat(summary.avg_response_time) || 0,
        },
        breakdown: detailResult.rows.map(row => ({
          [filters.groupBy]: row.group_key,
          requests: parseInt(row.requests),
          tokens: {
            input: parseInt(row.input_tokens) || 0,
            output: parseInt(row.output_tokens) || 0,
          },
          cost: parseFloat(row.cost) || 0,
          avgResponseTime: parseFloat(row.avg_response_time) || 0,
        })),
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  /**
   * LLM 프로바이더 정보 조회
   */
  async getProviders(): Promise<LLMProviderConfig[]> {
    try {
      if (!this.pool) {
        throw new Error('PostgreSQL not connected');
      }

      const query = `
        SELECT id, name, provider_type, api_endpoint, models, 
               rate_limits, config, status, health_check_url,
               last_health_check, created_at, updated_at
        FROM llm_providers 
        WHERE status = 'active'
        ORDER BY name
      `;

      const result = await this.pool.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        providerType: row.provider_type,
        apiEndpoint: row.api_endpoint,
        apiKeyHash: '', // 보안상 반환하지 않음
        models: row.models || [],
        rateLimits: row.rate_limits || {},
        config: row.config || {},
        status: row.status,
        healthCheckUrl: row.health_check_url,
        lastHealthCheck: row.last_health_check,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get providers:', error);
      throw error;
    }
  }

  /**
   * 사용량 로그 조회 (페이징)
   */
  async getUsageLogs(filters: {
    limit?: number;
    offset?: number;
    provider?: string;
    model?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: LLMUsageLog[]; total: number }> {
    try {
      if (!this.pool) {
        throw new Error('PostgreSQL not connected');
      }

      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.provider) {
        whereClause += ` AND provider_id = $${paramIndex}`;
        values.push(filters.provider);
        paramIndex++;
      }

      if (filters.model) {
        whereClause += ` AND model_name = $${paramIndex}`;
        values.push(filters.model);
        paramIndex++;
      }

      if (filters.status) {
        whereClause += ` AND status = $${paramIndex}`;
        values.push(filters.status);
        paramIndex++;
      }

      if (filters.startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        values.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        values.push(filters.endDate);
        paramIndex++;
      }

      // 총 개수 조회
      const countQuery = `SELECT COUNT(*) FROM llm_usage_logs ${whereClause}`;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // 로그 조회
      const logsQuery = `
        SELECT * FROM llm_usage_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      values.push(filters.limit || 50);
      values.push(filters.offset || 0);

      const logsResult = await this.pool.query(logsQuery, values);

      const logs = logsResult.rows.map(row => ({
        id: row.id,
        requestId: row.request_id,
        userId: row.user_id,
        providerId: row.provider_id,
        modelName: row.model_name,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        cost: parseFloat(row.cost),
        duration: row.duration_ms,
        status: row.status,
        errorMessage: row.error_message,
        cached: row.cached,
        templateId: row.template_id,
        createdAt: row.created_at,
      }));

      return { logs, total };
    } catch (error) {
      logger.error('Failed to get usage logs:', error);
      throw error;
    }
  }
}

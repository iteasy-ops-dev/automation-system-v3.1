/**
 * Queue Service - MCP Integration Service
 * Bull Queue 기반 비동기 작업 처리
 */

import Queue from 'bull';
import { Logger } from '../utils/logger';
import { EventBusService } from './event-bus.service';
import { MCPConnectionPoolService } from './connection-pool.service';

export interface MCPExecutionJob {
  executionId: string;
  serverId: string;
  toolName: string;
  params: Record<string, any>;
  timeout?: number;
  retries?: number;
}

export interface MCPDiscoveryJob {
  serverId: string;
  forceRefresh?: boolean;
}

export class QueueService {
  private executionQueue: Queue.Queue;
  private discoveryQueue: Queue.Queue;
  private logger: Logger;
  private eventBus: EventBusService;
  private connectionPool: MCPConnectionPoolService;

  constructor(
    eventBus: EventBusService,
    connectionPool: MCPConnectionPoolService,
    redisUrl?: string
  ) {
    this.logger = new Logger('queue-service');
    this.eventBus = eventBus;
    this.connectionPool = connectionPool;

    const redisConfig = {
      redis: redisUrl || process.env.BULL_REDIS_URL || 'redis://localhost:6379'
    };

    // 실행 큐 초기화
    this.executionQueue = new Queue('mcp-execution', redisConfig);
    
    // 디스커버리 큐 초기화
    this.discoveryQueue = new Queue('mcp-discovery', redisConfig);

    this.setupExecutionQueue();
    this.setupDiscoveryQueue();
    this.setupEventHandlers();
  }

  /**
   * MCP 도구 실행 작업 추가
   */
  async addExecutionJob(
    executionId: string,
    serverId: string,
    toolName: string,
    params: Record<string, any>,
    options: {
      timeout?: number;
      retries?: number;
      delay?: number;
      priority?: number;
    } = {}
  ): Promise<void> {
    const jobData: MCPExecutionJob = {
      executionId,
      serverId,
      toolName,
      params,
      timeout: options.timeout || 300000, // 5분 기본
      retries: options.retries || 3
    };

    const jobOptions = {
      delay: options.delay || 0,
      priority: options.priority || 0,
      attempts: jobData.retries + 1,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    };

    await this.executionQueue.add(jobData, jobOptions);
    
    this.logger.info(`🔄 Execution job queued`, {
      executionId,
      serverId,
      toolName
    });

    // 시작 이벤트 발행
    await this.eventBus.publishExecutionStarted(executionId, serverId, toolName, params);
  }

  /**
   * MCP 도구 디스커버리 작업 추가
   */
  async addDiscoveryJob(
    serverId: string,
    forceRefresh: boolean = false,
    delay: number = 0
  ): Promise<void> {
    const jobData: MCPDiscoveryJob = {
      serverId,
      forceRefresh
    };

    const jobOptions = {
      delay,
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5000
      },
      removeOnComplete: 50,
      removeOnFail: 25
    };

    await this.discoveryQueue.add(jobData, jobOptions);
    
    this.logger.info(`🔍 Discovery job queued`, { serverId, forceRefresh });
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const executionJob = await this.executionQueue.getJob(jobId);
      if (executionJob) {
        return {
          id: executionJob.id,
          status: await executionJob.getState(),
          progress: executionJob.progress(),
          data: executionJob.data,
          result: executionJob.returnvalue,
          error: executionJob.failedReason
        };
      }

      const discoveryJob = await this.discoveryQueue.getJob(jobId);
      if (discoveryJob) {
        return {
          id: discoveryJob.id,
          status: await discoveryJob.getState(),
          progress: discoveryJob.progress(),
          data: discoveryJob.data,
          result: discoveryJob.returnvalue,
          error: discoveryJob.failedReason
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * 큐 통계 조회
   */
  async getQueueStats(): Promise<any> {
    try {
      const [executionStats, discoveryStats] = await Promise.all([
        this.getQueueStatistics(this.executionQueue),
        this.getQueueStatistics(this.discoveryQueue)
      ]);

      return {
        execution: executionStats,
        discovery: discoveryStats
      };
    } catch (error) {
      this.logger.error('Failed to get queue statistics:', error);
      return null;
    }
  }

  /**
   * 서비스 종료
   */
  async close(): Promise<void> {
    try {
      await Promise.all([
        this.executionQueue.close(),
        this.discoveryQueue.close()
      ]);
      
      this.logger.info('Queue service closed');
    } catch (error) {
      this.logger.error('Error closing queue service:', error);
    }
  }

  // Private methods
  private setupExecutionQueue(): void {
    this.executionQueue.process(
      parseInt(process.env.BULL_MAX_CONCURRENT_JOBS || '5'),
      async (job) => {
        const { executionId, serverId, toolName, params, timeout } = job.data as MCPExecutionJob;
        
        this.logger.info(`🚀 Processing execution job`, {
          executionId,
          serverId,
          toolName,
          jobId: job.id
        });

        const startTime = Date.now();

        try {
          // 진행률 업데이트
          job.progress(10);

          // MCP 서버에서 도구 실행
          const result = await this.connectionPool.executeOnServer(serverId, toolName, params);
          
          job.progress(90);

          const duration = Date.now() - startTime;
          
          // 완료 이벤트 발행
          await this.eventBus.publishExecutionCompleted(executionId, serverId, result, duration);
          
          job.progress(100);
          
          this.logger.logSuccess(`Tool execution completed`, {
            executionId,
            serverId,
            toolName,
            duration
          });

          return {
            executionId,
            result,
            duration,
            completedAt: new Date().toISOString()
          };
        } catch (error) {
          this.logger.logFailure(`Tool execution failed`, error, {
            executionId,
            serverId,
            toolName,
            duration: Date.now() - startTime
          });

          // 실패 이벤트 발행
          await this.eventBus.publishExecutionFailed(executionId, serverId, error.message);
          
          throw error;
        }
      }
    );
  }

  private setupDiscoveryQueue(): void {
    this.discoveryQueue.process(5, async (job) => {
      const { serverId, forceRefresh } = job.data as MCPDiscoveryJob;
      
      this.logger.info(`🔍 Processing discovery job`, {
        serverId,
        forceRefresh,
        jobId: job.id
      });

      try {
        job.progress(20);

        // MCP 서버에서 도구 목록 조회
        const tools = await this.connectionPool.listToolsOnServer(serverId);
        
        job.progress(80);

        // 도구 발견 이벤트 발행
        await this.eventBus.publishToolsDiscovered(serverId, tools);
        
        job.progress(100);
        
        this.logger.logSuccess(`Tools discovered`, {
          serverId,
          toolCount: tools.length
        });

        return {
          serverId,
          tools,
          discoveredAt: new Date().toISOString()
        };
      } catch (error) {
        this.logger.logFailure(`Tool discovery failed`, error, { serverId });
        throw error;
      }
    });
  }

  private setupEventHandlers(): void {
    // 실행 큐 이벤트
    this.executionQueue.on('completed', (job, result) => {
      this.logger.debug(`✅ Execution job completed`, {
        jobId: job.id,
        executionId: result.executionId
      });
    });

    this.executionQueue.on('failed', (job, error) => {
      this.logger.error(`❌ Execution job failed`, {
        jobId: job.id,
        executionId: job.data.executionId,
        error: error.message
      });
    });

    this.executionQueue.on('stalled', (job) => {
      this.logger.warn(`⏸️ Execution job stalled`, {
        jobId: job.id,
        executionId: job.data.executionId
      });
    });

    // 디스커버리 큐 이벤트
    this.discoveryQueue.on('completed', (job, result) => {
      this.logger.debug(`✅ Discovery job completed`, {
        jobId: job.id,
        serverId: result.serverId,
        toolCount: result.tools.length
      });
    });

    this.discoveryQueue.on('failed', (job, error) => {
      this.logger.error(`❌ Discovery job failed`, {
        jobId: job.id,
        serverId: job.data.serverId,
        error: error.message
      });
    });
  }

  private async getQueueStatistics(queue: Queue.Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  }
}
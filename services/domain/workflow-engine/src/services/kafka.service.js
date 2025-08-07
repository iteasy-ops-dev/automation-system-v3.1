const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

class KafkaService {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.consumer = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.kafka = new Kafka({
        clientId: config.KAFKA_CLIENT_ID,
        brokers: config.KAFKA_BROKERS,
        retry: {
          initialRetryTime: 100,
          retries: 8
        }
      });

      // Producer 초기화
      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000
      });

      await this.producer.connect();
      this.isConnected = true;
      
      logger.info('✅ Kafka Producer 연결 성공');
    } catch (error) {
      logger.error('❌ Kafka 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      this.isConnected = false;
      logger.info('🔌 Kafka 연결 해제');
    } catch (error) {
      logger.error('❌ Kafka 연결 해제 실패:', error);
    }
  }

  async healthCheck() {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const metadata = await admin.fetchTopicMetadata({
        topics: ['workflow-events']
      });
      
      await admin.disconnect();
      
      return { 
        status: 'healthy', 
        topics: metadata.topics.length,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      logger.error('❌ Kafka 헬스체크 실패:', error);
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  // 워크플로우 이벤트 발행 (TASK-2 계약 준수)
  async publishWorkflowEvent(eventType, workflowId, executionId, payload = {}) {
    try {
      const event = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        workflowId,
        executionId,
        payload
      };

      const message = {
        topic: 'workflow-events',
        messages: [{
          key: executionId,
          value: JSON.stringify(event),
          headers: {
            eventType,
            source: 'workflow-engine-service',
            version: '1.0.0'
          }
        }]
      };

      await this.producer.send(message);
      
      logger.debug(`워크플로우 이벤트 발행: ${eventType} - ${executionId}`);
      return event.eventId;
    } catch (error) {
      logger.error('❌ 워크플로우 이벤트 발행 실패:', error);
      throw error;
    }
  }

  // 워크플로우 시작 이벤트
  async publishWorkflowStarted(workflowId, executionId, payload = {}) {
    return await this.publishWorkflowEvent(
      'WorkflowStarted',
      workflowId,
      executionId,
      {
        startedAt: new Date().toISOString(),
        ...payload
      }
    );
  }

  // 워크플로우 단계 시작 이벤트
  async publishWorkflowStepStarted(workflowId, executionId, stepId, stepName, payload = {}) {
    return await this.publishWorkflowEvent(
      'WorkflowStepStarted',
      workflowId,
      executionId,
      {
        stepId,
        stepName,
        startedAt: new Date().toISOString(),
        ...payload
      }
    );
  }

  // 워크플로우 단계 완료 이벤트
  async publishWorkflowStepCompleted(workflowId, executionId, stepId, stepName, result, duration) {
    return await this.publishWorkflowEvent(
      'WorkflowStepCompleted',
      workflowId,
      executionId,
      {
        stepId,
        stepName,
        result,
        duration,
        completedAt: new Date().toISOString()
      }
    );
  }

  // 워크플로우 단계 실패 이벤트
  async publishWorkflowStepFailed(workflowId, executionId, stepId, stepName, error) {
    return await this.publishWorkflowEvent(
      'WorkflowStepFailed',
      workflowId,
      executionId,
      {
        stepId,
        stepName,
        error: error.message,
        failedAt: new Date().toISOString()
      }
    );
  }

  // 워크플로우 완료 이벤트
  async publishWorkflowCompleted(workflowId, executionId, result, duration) {
    return await this.publishWorkflowEvent(
      'WorkflowCompleted',
      workflowId,
      executionId,
      {
        result,
        duration,
        completedAt: new Date().toISOString()
      }
    );
  }

  // 워크플로우 실패 이벤트
  async publishWorkflowFailed(workflowId, executionId, error, duration) {
    return await this.publishWorkflowEvent(
      'WorkflowFailed',
      workflowId,
      executionId,
      {
        error: error.message,
        stack: error.stack,
        duration,
        failedAt: new Date().toISOString()
      }
    );
  }

  // 워크플로우 취소 이벤트
  async publishWorkflowCancelled(workflowId, executionId, reason) {
    return await this.publishWorkflowEvent(
      'WorkflowCancelled',
      workflowId,
      executionId,
      {
        reason,
        cancelledAt: new Date().toISOString()
      }
    );
  }
}

// 싱글톤 인스턴스
const kafkaService = new KafkaService();

module.exports = kafkaService;
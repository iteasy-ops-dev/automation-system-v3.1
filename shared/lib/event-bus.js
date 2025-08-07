/**
 * 통합 자동화 시스템 v3.1 - Event Bus 헬퍼 라이브러리
 * TASK-6: Event Bus (Kafka) 설정
 * 계약 기반: shared/contracts/v1.0/events/ 스키마 준수
 */

const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// JSON Schema 로드
const deviceEventsSchema = require('../contracts/v1.0/events/device-events.json');
const mcpEventsSchema = require('../contracts/v1.0/events/mcp-events.json');
const llmEventsSchema = require('../contracts/v1.0/events/llm-events.json');
const workflowEventsSchema = require('../contracts/v1.0/events/workflow-events.json');

class EventBus {
    constructor(options = {}) {
        this.brokers = options.brokers || ['kafka:9092'];
        this.clientId = options.clientId || 'automation-system';
        this.groupId = options.groupId || 'default-group';
        
        // Kafka 클라이언트 초기화
        this.kafka = new Kafka({
            clientId: this.clientId,
            brokers: this.brokers,
            retry: {
                initialRetryTime: 100,
                retries: 8
            },
            connectionTimeout: 3000,
            requestTimeout: 30000
        });
        
        this.producer = null;
        this.consumers = new Map();
        
        // JSON Schema 검증기 초기화
        this.ajv = new Ajv({ strict: false });
        addFormats(this.ajv);
        
        // 스키마 컴파일
        this.validators = {
            'device-events': this.ajv.compile(deviceEventsSchema),
            'mcp-events': this.ajv.compile(mcpEventsSchema),
            'llm-events': this.ajv.compile(llmEventsSchema),
            'workflow-events': this.ajv.compile(workflowEventsSchema)
        };
        
        // 이벤트 리스너
        this.eventListeners = new Map();
        
        this.logger = options.logger || console;
    }
    
    /**
     * Event Bus 초기화
     */
    async initialize() {
        try {
            this.logger.info('EventBus 초기화 중...');
            
            // Producer 생성
            this.producer = this.kafka.producer({
                maxInFlightRequests: 1,
                idempotent: true,
                transactionTimeout: 30000
            });
            
            await this.producer.connect();
            this.logger.info('Kafka Producer 연결 완료');
            
            return true;
        } catch (error) {
            this.logger.error('EventBus 초기화 실패:', error);
            throw error;
        }
    }
    
    /**
     * 이벤트 발행
     * @param {string} topic - 토픽명
     * @param {Object} event - 이벤트 데이터
     * @param {Object} options - 발행 옵션
     */
    async publish(topic, event, options = {}) {
        try {
            // 이벤트 검증
            if (!this.validateEvent(topic, event)) {
                throw new Error(`Invalid event schema for topic: ${topic}`);
            }
            
            // 기본 메타데이터 추가
            const enrichedEvent = this.enrichEvent(event, options);
            
            // 메시지 발행
            const message = {
                topic,
                messages: [{
                    key: enrichedEvent.eventId,
                    value: JSON.stringify(enrichedEvent),
                    timestamp: Date.now(),
                    headers: {
                        'content-type': 'application/json',
                        'schema-version': '1.0.0',
                        'event-type': enrichedEvent.eventType
                    }
                }]
            };
            
            if (options.partition !== undefined) {
                message.messages[0].partition = options.partition;
            }
            
            const result = await this.producer.send(message);
            
            this.logger.debug(`Event published to ${topic}:`, {
                eventId: enrichedEvent.eventId,
                eventType: enrichedEvent.eventType,
                partition: result[0].partition,
                offset: result[0].offset
            });
            
            return result;
            
        } catch (error) {
            this.logger.error(`Failed to publish event to ${topic}:`, error);
            throw error;
        }
    }    
    /**
     * 이벤트 구독
     * @param {string} topic - 토픽명
     * @param {Function} handler - 이벤트 핸들러
     * @param {Object} options - 구독 옵션
     */
    async subscribe(topic, handler, options = {}) {
        try {
            const consumerGroupId = options.groupId || `${this.groupId}-${topic}`;
            
            // Consumer 생성
            const consumer = this.kafka.consumer({
                groupId: consumerGroupId,
                sessionTimeout: 30000,
                rebalanceTimeout: 60000,
                heartbeatInterval: 3000,
                retry: {
                    initialRetryTime: 100,
                    retries: 8
                }
            });
            
            await consumer.connect();
            await consumer.subscribe({ topics: [topic] });
            
            // 메시지 처리
            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const event = JSON.parse(message.value.toString());
                        
                        // 이벤트 검증
                        if (!this.validateEvent(topic, event)) {
                            this.logger.warn(`Invalid event received on ${topic}:`, event);
                            return;
                        }
                        
                        // 핸들러 실행
                        await handler(event, {
                            topic,
                            partition,
                            offset: message.offset,
                            timestamp: message.timestamp,
                            headers: message.headers
                        });
                        
                        this.logger.debug(`Event processed from ${topic}:`, {
                            eventId: event.eventId,
                            eventType: event.eventType,
                            partition,
                            offset: message.offset
                        });
                        
                    } catch (error) {
                        this.logger.error(`Error processing message from ${topic}:`, error);
                        
                        // 에러 핸들러가 있으면 실행
                        if (options.onError) {
                            await options.onError(error, { topic, partition, message });
                        }
                    }
                }
            });
            
            // Consumer 저장
            this.consumers.set(`${topic}-${consumerGroupId}`, consumer);
            
            this.logger.info(`Subscribed to topic: ${topic} with group: ${consumerGroupId}`);
            
            return consumer;
            
        } catch (error) {
            this.logger.error(`Failed to subscribe to ${topic}:`, error);
            throw error;
        }
    }
    
    /**
     * 이벤트 리스너 등록 (메모리 내 이벤트)
     * @param {string} eventType - 이벤트 타입
     * @param {Function} handler - 핸들러 함수
     */
    on(eventType, handler) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(handler);
    }
    
    /**
     * 메모리 내 이벤트 발행
     * @param {string} eventType - 이벤트 타입
     * @param {Object} data - 이벤트 데이터
     */
    emit(eventType, data) {
        const handlers = this.eventListeners.get(eventType);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    this.logger.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
    }    
    /**
     * 이벤트 검증
     * @param {string} topic - 토픽명
     * @param {Object} event - 이벤트 데이터
     * @returns {boolean} 검증 성공 여부
     */
    validateEvent(topic, event) {
        const validator = this.validators[topic];
        if (!validator) {
            this.logger.warn(`No validator found for topic: ${topic}`);
            return true; // 검증기가 없으면 통과
        }
        
        const isValid = validator(event);
        if (!isValid) {
            this.logger.error(`Event validation failed for ${topic}:`, validator.errors);
        }
        
        return isValid;
    }
    
    /**
     * 이벤트 메타데이터 추가
     * @param {Object} event - 원본 이벤트
     * @param {Object} options - 옵션
     * @returns {Object} 메타데이터가 추가된 이벤트
     */
    enrichEvent(event, options) {
        const enriched = { ...event };
        
        // 기본 필드 설정
        if (!enriched.eventId) {
            enriched.eventId = uuidv4();
        }
        
        if (!enriched.timestamp) {
            enriched.timestamp = new Date().toISOString();
        }
        
        // 메타데이터 기본값 설정
        if (!enriched.metadata) {
            enriched.metadata = {};
        }
        
        if (!enriched.metadata.version) {
            enriched.metadata.version = '1.0.0';
        }
        
        if (options.correlationId) {
            enriched.metadata.correlationId = options.correlationId;
        }
        
        if (options.source) {
            enriched.metadata.source = options.source;
        }
        
        if (options.userId) {
            enriched.metadata.userId = options.userId;
        }
        
        if (options.tags) {
            enriched.metadata.tags = options.tags;
        }
        
        return enriched;
    }    
    /**
     * 특정 토픽의 Consumer 중지
     * @param {string} topic - 토픽명
     * @param {string} groupId - Consumer Group ID
     */
    async unsubscribe(topic, groupId) {
        const key = `${topic}-${groupId || this.groupId}`;
        const consumer = this.consumers.get(key);
        
        if (consumer) {
            await consumer.disconnect();
            this.consumers.delete(key);
            this.logger.info(`Unsubscribed from topic: ${topic}`);
        }
    }
    
    /**
     * Event Bus 종료
     */
    async close() {
        try {
            this.logger.info('EventBus 종료 중...');
            
            // 모든 Consumer 종료
            for (const [key, consumer] of this.consumers) {
                try {
                    await consumer.disconnect();
                    this.logger.debug(`Consumer disconnected: ${key}`);
                } catch (error) {
                    this.logger.error(`Error disconnecting consumer ${key}:`, error);
                }
            }
            
            // Producer 종료
            if (this.producer) {
                await this.producer.disconnect();
                this.logger.info('Kafka Producer 연결 해제 완료');
            }
            
            this.consumers.clear();
            this.eventListeners.clear();
            
            this.logger.info('EventBus 종료 완료');
            
        } catch (error) {
            this.logger.error('EventBus 종료 중 오류 발생:', error);
            throw error;
        }
    }
    
    /**
     * 헬스체크
     * @returns {Object} 상태 정보
     */
    async healthCheck() {
        try {
            const admin = this.kafka.admin();
            await admin.connect();
            
            const metadata = await admin.fetchTopicMetadata();
            
            await admin.disconnect();
            
            return {
                status: 'healthy',
                brokers: this.brokers,
                topics: metadata.topics.map(t => t.name),
                consumers: Array.from(this.consumers.keys()),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}
// 편의 함수들
const EventTypes = {
    // Device Events
    DEVICE_CREATED: 'DeviceCreated',
    DEVICE_UPDATED: 'DeviceUpdated',
    DEVICE_DELETED: 'DeviceDeleted',
    DEVICE_STATUS_CHANGED: 'DeviceStatusChanged',
    METRIC_THRESHOLD_EXCEEDED: 'MetricThresholdExceeded',
    DEVICE_HEALTH_CHECK: 'DeviceHealthCheck',
    DEVICE_ALERT_TRIGGERED: 'DeviceAlertTriggered',
    DEVICE_MAINTENANCE_SCHEDULED: 'DeviceMaintenanceScheduled',
    
    // MCP Events
    MCP_SERVER_REGISTERED: 'MCPServerRegistered',
    MCP_SERVER_UPDATED: 'MCPServerUpdated',
    MCP_SERVER_DEREGISTERED: 'MCPServerDeregistered',
    MCP_SERVER_CONNECTION_ESTABLISHED: 'MCPServerConnectionEstablished',
    MCP_SERVER_CONNECTION_LOST: 'MCPServerConnectionLost',
    TOOLS_DISCOVERED: 'ToolsDiscovered',
    TOOL_UPDATED: 'ToolUpdated',
    EXECUTION_STARTED: 'ExecutionStarted',
    EXECUTION_COMPLETED: 'ExecutionCompleted',
    EXECUTION_FAILED: 'ExecutionFailed',
    EXECUTION_CANCELLED: 'ExecutionCancelled',
    
    // LLM Events
    LLM_REQUEST_STARTED: 'LLMRequestStarted',
    LLM_REQUEST_COMPLETED: 'LLMRequestCompleted',
    LLM_REQUEST_FAILED: 'LLMRequestFailed',
    TOKEN_LIMIT_EXCEEDED: 'TokenLimitExceeded',
    MODEL_SWITCHED: 'ModelSwitched',
    PROVIDER_HEALTH_CHECK: 'ProviderHealthCheck',
    CACHE_HIT: 'CacheHit',
    CACHE_MISS: 'CacheMiss',
    
    // Workflow Events
    WORKFLOW_STARTED: 'WorkflowStarted',
    WORKFLOW_STEP_STARTED: 'WorkflowStepStarted',
    WORKFLOW_STEP_COMPLETED: 'WorkflowStepCompleted',
    WORKFLOW_STEP_FAILED: 'WorkflowStepFailed',
    WORKFLOW_STEP_SKIPPED: 'WorkflowStepSkipped',
    WORKFLOW_PAUSED: 'WorkflowPaused',
    WORKFLOW_RESUMED: 'WorkflowResumed',
    WORKFLOW_COMPLETED: 'WorkflowCompleted',
    WORKFLOW_FAILED: 'WorkflowFailed',
    WORKFLOW_CANCELLED: 'WorkflowCancelled',
    WORKFLOW_RETRIED: 'WorkflowRetried'
};

const Topics = {
    DEVICE_EVENTS: 'device-events',
    MCP_EVENTS: 'mcp-events',
    LLM_EVENTS: 'llm-events',
    WORKFLOW_EVENTS: 'workflow-events'
};

module.exports = {
    EventBus,
    EventTypes,
    Topics
};
// MongoDB Configuration - TASK-3 스키마 기반
// 기반: infrastructure/database/schemas/mongodb-schema.js

import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/automation';
const MONGODB_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  bufferMaxEntries: 0,
  autoIndex: true,
  autoCreate: true
};

// 이벤트 로그 스키마 (TASK-3 정의와 100% 일치)
const eventLogSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'DeviceCreated',
      'DeviceUpdated', 
      'DeviceDeleted',
      'DeviceStatusChanged',
      'MetricThresholdExceeded',
      'MCPServerRegistered',
      'ToolsDiscovered',
      'ExecutionStarted',
      'ExecutionCompleted',
      'ExecutionFailed',
      'WorkflowStarted',
      'WorkflowStepCompleted',
      'WorkflowCompleted',
      'WorkflowFailed',
      'LLMRequestCompleted',
      'TokenLimitExceeded'
    ]
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  deviceId: {
    type: String,
    sparse: true
  },
  workflowId: {
    type: String,
    sparse: true
  },
  executionId: {
    type: String,
    sparse: true
  },
  serverId: {
    type: String,
    sparse: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: {
      userId: String,
      correlationId: String,
      source: String,
      sessionId: String
    },
    default: {}
  }
}, {
  timestamps: true,
  collection: 'event_logs'
});

// 인덱스 생성
eventLogSchema.index({ eventType: 1, timestamp: -1 });
eventLogSchema.index({ deviceId: 1, timestamp: -1 });
eventLogSchema.index({ workflowId: 1, timestamp: -1 });
eventLogSchema.index({ executionId: 1, timestamp: -1 });
eventLogSchema.index({ 'metadata.correlationId': 1 });

// 실행 로그 스키마
const executionLogSchema = new mongoose.Schema({
  executionId: {
    type: String,
    required: true,
    unique: true
  },
  workflowId: {
    type: String,
    required: true
  },
  stepId: {
    type: String,
    required: true
  },
  stepName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'running', 'completed', 'failed']
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  error: String,
  duration: Number,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  collection: 'execution_logs'
});

executionLogSchema.index({ executionId: 1, stepId: 1 });
executionLogSchema.index({ workflowId: 1, startedAt: -1 });
executionLogSchema.index({ status: 1, startedAt: -1 });

// 채팅 세션 스키마
const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed'],
    default: 'active'
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  workflowExecutions: [{
    executionId: String,
    workflowId: String,
    status: String,
    startedAt: Date,
    completedAt: Date
  }],
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  collection: 'chat_sessions'
});

chatSessionSchema.index({ sessionId: 1 });
chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ status: 1 });

// 모델 생성
export const EventLog = mongoose.model('EventLog', eventLogSchema);
export const ExecutionLog = mongoose.model('ExecutionLog', executionLogSchema);
export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

// MongoDB 연결 관리
export class MongoDBConnection {
  private static instance: MongoDBConnection;
  private isConnected = false;

  static getInstance(): MongoDBConnection {
    if (!MongoDBConnection.instance) {
      MongoDBConnection.instance = new MongoDBConnection();
    }
    return MongoDBConnection.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
      this.isConnected = true;
      console.log('✅ MongoDB 연결 성공');

      // 연결 이벤트 핸들러
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB 연결 오류:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB 연결 끊김');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB 재연결 성공');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('❌ MongoDB 연결 실패:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('✅ MongoDB 연결 종료');
    } catch (error) {
      console.error('❌ MongoDB 연결 종료 실패:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const state = mongoose.connection.readyState;
      return state === 1; // 1 = connected
    } catch (error) {
      console.error('❌ MongoDB Health Check 실패:', error);
      return false;
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

// 편의 함수들
export const connectMongoDB = () => MongoDBConnection.getInstance().connect();
export const disconnectMongoDB = () => MongoDBConnection.getInstance().disconnect();
export const checkMongoHealth = () => MongoDBConnection.getInstance().checkHealth();

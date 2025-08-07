// ========================================
// MongoDB 초기화 스크립트
// Docker 컨테이너 시작 시 자동 실행
// ========================================

// automation 데이터베이스로 전환
db = db.getSiblingDB('automation');

// 사용자 생성 (이미 존재할 경우 무시)
try {
    db.createUser({
        user: "automation_app",
        pwd: "automation_app_password",
        roles: [
            {
                role: "readWrite",
                db: "automation"
            }
        ]
    });
    print("MongoDB user 'automation_app' created successfully.");
} catch (e) {
    if (e.code === 51003) {
        print("MongoDB user 'automation_app' already exists, skipping creation.");
    } else {
        throw e;
    }
}

// 컬렉션 생성 및 스키마 검증 설정
print("Creating MongoDB collections with schema validation...");

// 채팅 세션 컬렉션
try {
    db.createCollection("chat_sessions", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["sessionId", "userId", "status", "createdAt"],
                properties: {
                    sessionId: { bsonType: "string" },
                    userId: { bsonType: "string" },
                    status: { enum: ["active", "completed", "aborted"] },
                    createdAt: { bsonType: "date" }
                }
            }
        }
    });
    print("Created chat_sessions collection.");
} catch (e) {
    print("chat_sessions collection may already exist.");
}

// 실행 로그 컬렉션
try {
    db.createCollection("execution_logs", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["logId", "executionId", "executionType", "level", "message", "timestamp"],
                properties: {
                    logId: { bsonType: "string" },
                    executionId: { bsonType: "string" },
                    executionType: { enum: ["workflow", "mcp", "device", "llm"] },
                    level: { enum: ["debug", "info", "warn", "error", "fatal"] },
                    message: { bsonType: "string" },
                    timestamp: { bsonType: "date" }
                }
            }
        }
    });
    print("Created execution_logs collection.");
} catch (e) {
    print("execution_logs collection may already exist.");
}

// MCP 도구 카탈로그 컬렉션
try {
    db.createCollection("mcp_tool_catalog", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["catalogId", "serverId", "toolName", "version", "isEnabled", "lastDiscovered"],
                properties: {
                    catalogId: { bsonType: "string" },
                    serverId: { bsonType: "string" },
                    toolName: { bsonType: "string" },
                    version: { bsonType: "string" },
                    isEnabled: { bsonType: "bool" },
                    lastDiscovered: { bsonType: "date" }
                }
            }
        }
    });
    print("Created mcp_tool_catalog collection.");
} catch (e) {
    print("mcp_tool_catalog collection may already exist.");
}

// 프롬프트 템플릿 컬렉션
try {
    db.createCollection("prompt_templates", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["templateId", "name", "content", "version", "isActive", "createdAt"],
                properties: {
                    templateId: { bsonType: "string" },
                    name: { bsonType: "string" },
                    content: { bsonType: "string" },
                    version: { bsonType: "string" },
                    isActive: { bsonType: "bool" },
                    createdAt: { bsonType: "date" }
                }
            }
        }
    });
    print("Created prompt_templates collection.");
} catch (e) {
    print("prompt_templates collection may already exist.");
}

// 시스템 이벤트 컬렉션
try {
    db.createCollection("system_events", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: ["eventId", "eventType", "timestamp"],
                properties: {
                    eventId: { 
                        bsonType: "string",
                        pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                    },
                    eventType: { 
                        enum: [
                            "DeviceCreated", "DeviceUpdated", "DeviceDeleted", "DeviceStatusChanged",
                            "MetricThresholdExceeded", "WorkflowStarted", "WorkflowCompleted",
                            "WorkflowFailed", "MCPServerRegistered", "ExecutionStarted",
                            "ExecutionCompleted", "LLMRequestCompleted"
                        ]
                    },
                    timestamp: { bsonType: "date" }
                }
            }
        }
    });
    print("Created system_events collection.");
} catch (e) {
    print("system_events collection may already exist.");
}

// 인덱스 생성
print("Creating indexes...");

// 채팅 세션 인덱스
db.chat_sessions.createIndex({ "sessionId": 1 }, { unique: true });
db.chat_sessions.createIndex({ "userId": 1 });
db.chat_sessions.createIndex({ "createdAt": 1 });

// 실행 로그 인덱스
db.execution_logs.createIndex({ "executionId": 1 });
db.execution_logs.createIndex({ "timestamp": 1 });
db.execution_logs.createIndex({ "level": 1 });

// MCP 도구 카탈로그 인덱스
db.mcp_tool_catalog.createIndex({ "serverId": 1, "toolName": 1 }, { unique: true });
db.mcp_tool_catalog.createIndex({ "isEnabled": 1 });

// 프롬프트 템플릿 인덱스
db.prompt_templates.createIndex({ "templateId": 1 }, { unique: true });
db.prompt_templates.createIndex({ "name": 1 });
db.prompt_templates.createIndex({ "isActive": 1 });

// 시스템 이벤트 인덱스
db.system_events.createIndex({ "eventId": 1 }, { unique: true });
db.system_events.createIndex({ "eventType": 1 });
db.system_events.createIndex({ "timestamp": 1 });

print("Indexes created successfully.");

// 기본 데이터 삽입
print("Inserting initial data...");

// 기본 프롬프트 템플릿
db.prompt_templates.insertMany([
    {
        templateId: "intent-analysis-v1",
        name: "의도 분석 템플릿",
        description: "사용자 메시지에서 의도를 분석하는 템플릿",
        category: "analysis",
        content: "사용자의 다음 메시지를 분석하여 의도를 파악해주세요:\n\n메시지: {{userMessage}}\n\n다음 형식으로 응답해주세요:\n- 액션: {{action}}\n- 대상: {{target}}\n- 파라미터: {{parameters}}",
        variables: [
            { name: "userMessage", type: "string", required: true, description: "분석할 사용자 메시지" }
        ],
        version: "1.0.0",
        language: "ko",
        tags: ["intent", "analysis", "workflow"],
        isActive: true,
        usageCount: 0,
        createdBy: "system",
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        templateId: "operation-summary-v1",
        name: "작업 요약 템플릿",
        description: "워크플로우 실행 결과를 요약하는 템플릿",
        category: "summary",
        content: "다음 작업이 완료되었습니다:\n\n작업: {{operation}}\n대상: {{targets}}\n결과: {{results}}",
        variables: [
            { name: "operation", type: "string", required: true, description: "수행된 작업" },
            { name: "targets", type: "array", required: true, description: "작업 대상 목록" },
            { name: "results", type: "object", required: true, description: "작업 결과" }
        ],
        version: "1.0.0",
        language: "ko",
        tags: ["summary", "workflow", "results"],
        isActive: true,
        usageCount: 0,
        createdBy: "system",
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

print("Initial data inserted successfully.");
print("MongoDB initialization completed.");

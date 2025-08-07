/**
 * 통합 자동화 시스템 MongoDB 스키마
 * 버전: v3.1.0
 * 계약 기반: shared/contracts/v1.0/events/*.json
 */

// ========================================
// 채팅 세션 컬렉션
// ========================================

db.chat_sessions.createIndex({ "sessionId": 1 }, { unique: true });
db.chat_sessions.createIndex({ "userId": 1 });
db.chat_sessions.createIndex({ "createdAt": 1 });
db.chat_sessions.createIndex({ "status": 1 });

// 채팅 세션 스키마 검증
db.createCollection("chat_sessions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["sessionId", "userId", "status", "createdAt"],
      properties: {
        sessionId: {
          bsonType: "string",
          description: "세션 고유 ID (UUID)"
        },
        userId: {
          bsonType: "string",
          description: "사용자 ID"
        },
        status: {
          enum: ["active", "completed", "aborted"],
          description: "세션 상태"
        },
        context: {
          bsonType: "object",
          description: "세션 컨텍스트 정보"
        },
        messages: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["messageId", "role", "content", "timestamp"],
            properties: {
              messageId: { bsonType: "string" },
              role: { enum: ["user", "assistant", "system"] },
              content: { bsonType: "string" },
              timestamp: { bsonType: "date" },
              metadata: { bsonType: "object" }
            }
          }
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        completedAt: { bsonType: "date" }
      }
    }
  }
});

// ========================================
// 실행 로그 컬렉션 (상세 로그)
// ========================================

db.execution_logs.createIndex({ "executionId": 1 });
db.execution_logs.createIndex({ "executionType": 1 });
db.execution_logs.createIndex({ "timestamp": 1 });
db.execution_logs.createIndex({ "level": 1 });
db.execution_logs.createIndex({ "deviceId": 1 });

// 실행 로그 스키마 검증
db.createCollection("execution_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["logId", "executionId", "executionType", "level", "message", "timestamp"],
      properties: {
        logId: {
          bsonType: "string",
          description: "로그 고유 ID"
        },
        executionId: {
          bsonType: "string",
          description: "실행 ID (워크플로우 또는 MCP 실행)"
        },
        executionType: {
          enum: ["workflow", "mcp", "device", "llm"],
          description: "실행 타입"
        },
        level: {
          enum: ["debug", "info", "warn", "error", "fatal"],
          description: "로그 레벨"
        },
        message: {
          bsonType: "string",
          description: "로그 메시지"
        },
        details: {
          bsonType: "object",
          description: "상세 정보"
        },
        deviceId: {
          bsonType: "string",
          description: "관련 장비 ID (선택사항)"
        },
        userId: {
          bsonType: "string",
          description: "사용자 ID (선택사항)"
        },
        timestamp: {
          bsonType: "date",
          description: "로그 생성 시간"
        },
        stackTrace: {
          bsonType: "string",
          description: "오류 스택 트레이스 (오류 시)"
        },
        correlationId: {
          bsonType: "string",
          description: "상관관계 추적 ID"
        }
      }
    }
  }
});

// ========================================
// MCP 도구 카탈로그 컬렉션
// ========================================

db.mcp_tool_catalog.createIndex({ "serverId": 1, "toolName": 1 }, { unique: true });
db.mcp_tool_catalog.createIndex({ "toolName": 1 });
db.mcp_tool_catalog.createIndex({ "category": 1 });
db.mcp_tool_catalog.createIndex({ "isEnabled": 1 });

// MCP 도구 카탈로그 스키마 검증
db.createCollection("mcp_tool_catalog", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["catalogId", "serverId", "toolName", "version", "isEnabled", "lastDiscovered"],
      properties: {
        catalogId: {
          bsonType: "string",
          description: "카탈로그 항목 고유 ID"
        },
        serverId: {
          bsonType: "string",
          description: "MCP 서버 ID"
        },
        toolName: {
          bsonType: "string",
          description: "도구 이름"
        },
        displayName: {
          bsonType: "string",
          description: "표시용 도구 이름"
        },
        description: {
          bsonType: "string",
          description: "도구 설명"
        },
        version: {
          bsonType: "string",
          description: "도구 버전"
        },
        category: {
          bsonType: "string",
          description: "도구 카테고리"
        },
        schema: {
          bsonType: "object",
          description: "도구 스키마 정의"
        },
        inputSchema: {
          bsonType: "object",
          description: "입력 파라미터 스키마"
        },
        outputSchema: {
          bsonType: "object",
          description: "출력 결과 스키마"
        },
        capabilities: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "도구 기능 목록"
        },
        tags: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "도구 태그"
        },
        isEnabled: {
          bsonType: "bool",
          description: "활성화 상태"
        },
        usageCount: {
          bsonType: "int",
          description: "사용 횟수"
        },
        lastUsed: {
          bsonType: "date",
          description: "마지막 사용 시간"
        },
        lastDiscovered: {
          bsonType: "date",
          description: "마지막 발견 시간"
        },
        metadata: {
          bsonType: "object",
          description: "추가 메타데이터"
        }
      }
    }
  }
});

// ========================================
// 프롬프트 템플릿 컬렉션
// ========================================

db.prompt_templates.createIndex({ "templateId": 1 }, { unique: true });
db.prompt_templates.createIndex({ "name": 1 });
db.prompt_templates.createIndex({ "category": 1 });
db.prompt_templates.createIndex({ "isActive": 1 });

// 프롬프트 템플릿 스키마 검증
db.createCollection("prompt_templates", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["templateId", "name", "content", "version", "isActive", "createdAt"],
      properties: {
        templateId: {
          bsonType: "string",
          description: "템플릿 고유 ID"
        },
        name: {
          bsonType: "string",
          description: "템플릿 이름"
        },
        description: {
          bsonType: "string",
          description: "템플릿 설명"
        },
        category: {
          bsonType: "string",
          description: "템플릿 카테고리"
        },
        content: {
          bsonType: "string",
          description: "프롬프트 템플릿 내용"
        },
        variables: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["name", "type"],
            properties: {
              name: { bsonType: "string" },
              type: { enum: ["string", "number", "boolean", "array", "object"] },
              required: { bsonType: "bool" },
              defaultValue: {},
              description: { bsonType: "string" }
            }
          },
          description: "템플릿 변수 정의"
        },
        version: {
          bsonType: "string",
          description: "템플릿 버전"
        },
        language: {
          bsonType: "string",
          description: "템플릿 언어"
        },
        tags: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "템플릿 태그"
        },
        isActive: {
          bsonType: "bool",
          description: "활성화 상태"
        },
        usageCount: {
          bsonType: "int",
          description: "사용 횟수"
        },
        createdBy: {
          bsonType: "string",
          description: "생성자 ID"
        },
        createdAt: {
          bsonType: "date",
          description: "생성 시간"
        },
        updatedAt: {
          bsonType: "date",
          description: "수정 시간"
        }
      }
    }
  }
});

// ========================================
// 파일 메타데이터 컬렉션
// ========================================

db.file_metadata.createIndex({ "fileId": 1 }, { unique: true });
db.file_metadata.createIndex({ "executionId": 1 });
db.file_metadata.createIndex({ "fileType": 1 });
db.file_metadata.createIndex({ "uploadedBy": 1 });

// 파일 메타데이터 스키마 검증
db.createCollection("file_metadata", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["fileId", "fileName", "fileType", "fileSize", "uploadedAt"],
      properties: {
        fileId: {
          bsonType: "string",
          description: "파일 고유 ID"
        },
        fileName: {
          bsonType: "string",
          description: "원본 파일명"
        },
        fileType: {
          bsonType: "string",
          description: "파일 타입/확장자"
        },
        fileSize: {
          bsonType: "long",
          description: "파일 크기 (bytes)"
        },
        mimeType: {
          bsonType: "string",
          description: "MIME 타입"
        },
        s3Key: {
          bsonType: "string",
          description: "S3 객체 키"
        },
        s3Bucket: {
          bsonType: "string",
          description: "S3 버킷명"
        },
        checksum: {
          bsonType: "string",
          description: "파일 체크섬 (SHA256)"
        },
        executionId: {
          bsonType: "string",
          description: "관련 실행 ID"
        },
        uploadedBy: {
          bsonType: "string",
          description: "업로드한 사용자 ID"
        },
        uploadedAt: {
          bsonType: "date",
          description: "업로드 시간"
        },
        expiresAt: {
          bsonType: "date",
          description: "만료 시간"
        },
        metadata: {
          bsonType: "object",
          description: "추가 메타데이터"
        }
      }
    }
  }
});

// ========================================
// 시스템 이벤트 컬렉션 (Device Events 계약 기반)
// ========================================

db.system_events.createIndex({ "eventId": 1 }, { unique: true });
db.system_events.createIndex({ "eventType": 1 });
db.system_events.createIndex({ "timestamp": 1 });
db.system_events.createIndex({ "deviceId": 1 });
db.system_events.createIndex({ "correlationId": 1 });

// 시스템 이벤트 스키마 검증 (device-events.json 계약 기반)
db.createCollection("system_events", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["eventId", "eventType", "timestamp"],
      properties: {
        eventId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "이벤트 고유 ID (UUID)"
        },
        eventType: {
          enum: [
            "DeviceCreated", "DeviceUpdated", "DeviceDeleted", "DeviceStatusChanged",
            "MetricThresholdExceeded", "DeviceHealthCheck", "DeviceAlertTriggered",
            "DeviceMaintenanceScheduled", "WorkflowStarted", "WorkflowStepCompleted",
            "WorkflowCompleted", "WorkflowFailed", "MCPServerRegistered", "ToolsDiscovered",
            "ExecutionStarted", "ExecutionCompleted", "ExecutionFailed", "LLMRequestCompleted",
            "TokenLimitExceeded", "ModelSwitched"
          ],
          description: "이벤트 타입"
        },
        timestamp: {
          bsonType: "date",
          description: "이벤트 발생 시간"
        },
        deviceId: {
          bsonType: "string",
          description: "관련 장비 ID (장비 이벤트인 경우)"
        },
        workflowId: {
          bsonType: "string",
          description: "관련 워크플로우 ID (워크플로우 이벤트인 경우)"
        },
        executionId: {
          bsonType: "string",
          description: "관련 실행 ID"
        },
        serverId: {
          bsonType: "string",
          description: "관련 MCP 서버 ID (MCP 이벤트인 경우)"
        },
        payload: {
          bsonType: "object",
          description: "이벤트별 페이로드 데이터"
        },
        metadata: {
          bsonType: "object",
          properties: {
            userId: { bsonType: "string" },
            correlationId: { bsonType: "string" },
            source: { bsonType: "string" },
            version: { bsonType: "string" },
            tags: {
              bsonType: "array",
              items: { bsonType: "string" }
            }
          },
          description: "이벤트 메타데이터"
        }
      }
    }
  }
});

// ========================================
// 캐시 컬렉션
// ========================================

db.cache_entries.createIndex({ "key": 1 }, { unique: true });
db.cache_entries.createIndex({ "expiresAt": 1 });
db.cache_entries.createIndex({ "category": 1 });

// 캐시 엔트리 스키마 검증
db.createCollection("cache_entries", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["key", "value", "createdAt"],
      properties: {
        key: {
          bsonType: "string",
          description: "캐시 키"
        },
        value: {
          bsonType: "object",
          description: "캐시된 값"
        },
        category: {
          bsonType: "string",
          description: "캐시 카테고리"
        },
        ttl: {
          bsonType: "int",
          description: "TTL (초)"
        },
        createdAt: {
          bsonType: "date",
          description: "생성 시간"
        },
        expiresAt: {
          bsonType: "date",
          description: "만료 시간"
        },
        accessCount: {
          bsonType: "int",
          description: "접근 횟수"
        },
        lastAccessed: {
          bsonType: "date",
          description: "마지막 접근 시간"
        }
      }
    }
  }
});

// TTL 인덱스 (자동 만료)
db.cache_entries.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// ========================================
// 컬렉션 샤딩 설정 (대용량 데이터용)
// ========================================

// 대용량 로그 컬렉션은 월별로 분할
// db.execution_logs_202401, db.execution_logs_202402, ... 형태로 생성

// ========================================
// 기본 데이터 삽입
// ========================================

// 기본 프롬프트 템플릿
db.prompt_templates.insertMany([
  {
    templateId: "intent-analysis-v1",
    name: "의도 분석 템플릿",
    description: "사용자 메시지에서 의도를 분석하는 템플릿",
    category: "analysis",
    content: "사용자의 다음 메시지를 분석하여 의도를 파악해주세요:\n\n메시지: {{userMessage}}\n\n다음 형식으로 응답해주세요:\n- 액션: {{action}}\n- 대상: {{target}}\n- 파라미터: {{parameters}}",
    variables: [
      { name: "userMessage", type: "string", required: true, description: "분석할 사용자 메시지" },
      { name: "action", type: "string", required: true, description: "수행할 액션" },
      { name: "target", type: "string", required: true, description: "액션 대상" },
      { name: "parameters", type: "object", required: false, description: "추가 파라미터" }
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
    content: "다음 작업이 완료되었습니다:\n\n작업: {{operation}}\n대상: {{targets}}\n결과: {{results}}\n\n상세 내용:\n{{details}}",
    variables: [
      { name: "operation", type: "string", required: true, description: "수행된 작업" },
      { name: "targets", type: "array", required: true, description: "작업 대상 목록" },
      { name: "results", type: "object", required: true, description: "작업 결과" },
      { name: "details", type: "string", required: false, description: "상세 내용" }
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

print("MongoDB 스키마 및 초기 데이터 설정 완료");

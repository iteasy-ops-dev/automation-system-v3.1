#!/bin/bash

# ===========================================
# TASK-6: Kafka 토픽 설정 스크립트
# ===========================================
# 통합 자동화 시스템 v3.1에서 사용할 4개 핵심 토픽 생성

echo "🚀 Creating Kafka topics for Automation System v3.1..."

# Kafka 서버가 준비될 때까지 대기
echo "⏳ Waiting for Kafka to be ready..."
sleep 10

# 토픽 생성 함수
create_topic() {
    local topic_name=$1
    local partitions=${2:-3}
    local replication_factor=${3:-1}
    
    echo "📝 Creating topic: $topic_name (partitions: $partitions, replication: $replication_factor)"
    
    kafka-topics --bootstrap-server kafka:9092 \
        --create \
        --topic "$topic_name" \
        --partitions "$partitions" \
        --replication-factor "$replication_factor" \
        --if-not-exists
    
    if [ $? -eq 0 ]; then
        echo "✅ Topic '$topic_name' created successfully"
    else
        echo "❌ Failed to create topic '$topic_name'"
    fi
}

# 4개 핵심 토픽 생성
echo ""
echo "=== Creating Domain Event Topics ==="

# 1. Device Events (Device Management Service)
create_topic "device-events" 3 1

# 2. MCP Events (MCP Integration Service)  
create_topic "mcp-events" 3 1

# 3. LLM Events (LLM Service)
create_topic "llm-events" 3 1

# 4. Workflow Events (Workflow Engine Service)
create_topic "workflow-events" 3 1

# 추가 시스템 토픽
echo ""
echo "=== Creating System Topics ==="

# 5. System Events (전체 시스템 이벤트)
create_topic "system-events" 3 1

# 6. Audit Events (감사 로그)
create_topic "audit-events" 5 1

echo ""
echo "📋 Listing all topics:"
kafka-topics --bootstrap-server kafka:9092 --list

echo ""
echo "🎉 Kafka topics setup completed!"

# 토픽 세부 정보 확인
echo ""
echo "=== Topic Details ==="
for topic in device-events mcp-events llm-events workflow-events system-events audit-events; do
    echo ""
    echo "--- $topic ---"
    kafka-topics --bootstrap-server kafka:9092 --describe --topic "$topic"
done

echo ""
echo "✅ TASK-6: Kafka 토픽 설정 완료!"

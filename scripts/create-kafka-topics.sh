#!/bin/bash
# Kafka 토픽 생성 스크립트
# v3.1 아키텍처에 필요한 모든 토픽 생성

echo "🚀 Kafka 토픽 생성 시작..."

# Kafka 컨테이너 이름
KAFKA_CONTAINER="automation-kafka"

# 토픽 목록 (이름:파티션:복제본)
TOPICS=(
  "mcp-events:3:1"
  "llm-events:3:1"
  "workflow-events:3:1"
  "system-events:3:1"
)

# 각 토픽 생성
for TOPIC_CONFIG in "${TOPICS[@]}"; do
  IFS=':' read -r TOPIC_NAME PARTITIONS REPLICATION <<< "$TOPIC_CONFIG"
  
  echo "📦 토픽 생성: $TOPIC_NAME (파티션: $PARTITIONS, 복제본: $REPLICATION)"
  
  docker exec $KAFKA_CONTAINER /bin/kafka-topics \
    --create \
    --bootstrap-server localhost:9092 \
    --topic $TOPIC_NAME \
    --partitions $PARTITIONS \
    --replication-factor $REPLICATION \
    --if-not-exists
  
  if [ $? -eq 0 ]; then
    echo "✅ $TOPIC_NAME 토픽 생성 완료"
  else
    echo "⚠️  $TOPIC_NAME 토픽 생성 실패 (이미 존재할 수 있음)"
  fi
done

echo ""
echo "📋 생성된 토픽 목록:"
docker exec $KAFKA_CONTAINER /bin/kafka-topics \
  --list \
  --bootstrap-server localhost:9092

echo ""
echo "✅ Kafka 토픽 생성 완료!"
echo ""
echo "🔄 서비스 재시작 중..."

# 영향받는 서비스만 재시작
docker-compose restart gateway storage device-service mcp-service llm-service workflow-engine

echo "⏳ 서비스 안정화 대기 (30초)..."
sleep 30

echo "✅ 모든 작업 완료!"
echo "📍 대시보드 확인: http://localhost:3001"

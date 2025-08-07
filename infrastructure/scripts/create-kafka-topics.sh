#!/bin/bash

# 통합 자동화 시스템 v3.1 - Kafka 토픽 생성 스크립트
# TASK-6: Event Bus (Kafka) 설정
# 계약 기반: shared/contracts/v1.0/events/ 스키마 준수

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 환경 변수 설정
KAFKA_CONTAINER=${KAFKA_CONTAINER:-automation-kafka}
KAFKA_BROKER=${KAFKA_BROKER:-kafka:9092}
PARTITIONS=${PARTITIONS:-3}
REPLICATION_FACTOR=${REPLICATION_FACTOR:-1}
RETENTION_HOURS=${RETENTION_HOURS:-168}  # 7 days

# 토픽 정의 (TASK-2 계약 기반)
declare -A TOPICS=(
    ["device-events"]="장비 관련 이벤트 토픽"
    ["mcp-events"]="MCP 서버 및 도구 실행 이벤트 토픽"
    ["llm-events"]="LLM 요청 및 응답 이벤트 토픽"
    ["workflow-events"]="워크플로우 실행 이벤트 토픽"
)

# Kafka 연결 대기 함수
wait_for_kafka() {
    log_info "Kafka 서버 연결 대기 중..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $KAFKA_CONTAINER kafka-broker-api-versions --bootstrap-server $KAFKA_BROKER > /dev/null 2>&1; then
            log_success "Kafka 서버에 연결되었습니다."
            return 0
        fi
        
        log_info "Kafka 연결 시도 $attempt/$max_attempts..."
        sleep 5
        ((attempt++))
    done
    
    log_error "Kafka 서버에 연결할 수 없습니다."
    return 1
}

# 토픽 존재 확인 함수
topic_exists() {
    local topic_name=$1
    docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_BROKER --list | grep -q "^${topic_name}$"
}

# 토픽 생성 함수
create_topic() {
    local topic_name=$1
    local description=$2
    
    log_info "토픽 생성 중: $topic_name"
    
    if topic_exists "$topic_name"; then
        log_warning "토픽 '$topic_name'이 이미 존재합니다. 건너뜁니다."
        return 0
    fi
    
    # 토픽 생성
    if docker exec $KAFKA_CONTAINER kafka-topics \
        --bootstrap-server $KAFKA_BROKER \
        --create \
        --topic "$topic_name" \
        --partitions $PARTITIONS \
        --replication-factor $REPLICATION_FACTOR \
        --config retention.ms=$((RETENTION_HOURS * 3600 * 1000)) \
        --config compression.type=snappy \
        --config cleanup.policy=delete; then
        
        log_success "토픽 '$topic_name' 생성 완료"
        log_info "  - 설명: $description"
        log_info "  - 파티션: $PARTITIONS"
        log_info "  - 복제 팩터: $REPLICATION_FACTOR"
        log_info "  - 보존 기간: ${RETENTION_HOURS}시간"
    else
        log_error "토픽 '$topic_name' 생성 실패"
        return 1
    fi
}

# 토픽 상세 정보 출력 함수
describe_topic() {
    local topic_name=$1
    
    log_info "토픽 '$topic_name' 상세 정보:"
    docker exec $KAFKA_CONTAINER kafka-topics \
        --bootstrap-server $KAFKA_BROKER \
        --describe \
        --topic "$topic_name"
}

# 토픽 목록 출력 함수
list_topics() {
    log_info "생성된 토픽 목록:"
    docker exec $KAFKA_CONTAINER kafka-topics \
        --bootstrap-server $KAFKA_BROKER \
        --list | grep -E "(device-events|mcp-events|llm-events|workflow-events)" || true
}

# 메인 실행 함수
main() {
    log_info "=== Kafka 토픽 생성 스크립트 시작 ==="
    log_info "TASK-6: Event Bus (Kafka) 설정"
    log_info "계약 기준: shared/contracts/v1.0/events/"
    
    # Kafka 연결 확인
    if ! wait_for_kafka; then
        log_error "Kafka 서버에 연결할 수 없습니다. Docker Compose가 실행 중인지 확인하세요."
        exit 1
    fi
    
    # 각 토픽 생성
    local success_count=0
    local total_count=${#TOPICS[@]}
    
    for topic_name in "${!TOPICS[@]}"; do
        description="${TOPICS[$topic_name]}"
        if create_topic "$topic_name" "$description"; then
            ((success_count++))
        fi
    done
    
    echo
    log_info "=== 토픽 생성 결과 ==="
    log_success "$success_count/$total_count 토픽 생성 완료"
    
    # 생성된 토픽 목록 출력
    echo
    list_topics
    
    # 각 토픽의 상세 정보 출력
    echo
    for topic_name in "${!TOPICS[@]}"; do
        if topic_exists "$topic_name"; then
            describe_topic "$topic_name"
            echo
        fi
    done
    
    log_success "=== Kafka 토픽 생성 완료 ==="
}

# 스크립트 직접 실행 시
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
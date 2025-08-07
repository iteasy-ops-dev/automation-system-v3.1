#!/bin/bash

# 통합 자동화 시스템 v3.1 - Schema Registry 스키마 등록 스크립트
# TASK-6: Event Bus (Kafka) 설정
# 계약 기반: shared/contracts/v1.0/events/ JSON 스키마 등록

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
SCHEMA_REGISTRY_URL=${SCHEMA_REGISTRY_URL:-http://localhost:8081}
CONTRACTS_DIR=${CONTRACTS_DIR:-/Users/leesg/Documents/work_ops/automation-system/shared/contracts/v1.0/events}

# Schema Registry 연결 대기 함수
wait_for_schema_registry() {
    log_info "Schema Registry 서버 연결 대기 중..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$SCHEMA_REGISTRY_URL/subjects" > /dev/null 2>&1; then
            log_success "Schema Registry 서버에 연결되었습니다."
            return 0
        fi
        
        log_info "Schema Registry 연결 시도 $attempt/$max_attempts..."
        sleep 5
        ((attempt++))
    done
    
    log_error "Schema Registry 서버에 연결할 수 없습니다."
    return 1
}

# JSON 스키마를 Schema Registry 형식으로 변환하는 함수
convert_to_avro_format() {
    local json_schema_file=$1
    local temp_file=$(mktemp)
    
    # JSON Schema를 Avro Schema Registry 형식으로 래핑
    cat << EOF > "$temp_file"
{
  "schema": $(cat "$json_schema_file" | jq -c .)
}
EOF
    
    echo "$temp_file"
}

# 스키마 등록 함수
register_schema() {
    local subject_name=$1
    local schema_file=$2
    
    log_info "스키마 등록 중: $subject_name"
    
    if [[ ! -f "$schema_file" ]]; then
        log_error "스키마 파일을 찾을 수 없습니다: $schema_file"
        return 1
    fi
    
    # JSON 스키마를 Schema Registry 형식으로 변환
    local converted_schema
    converted_schema=$(convert_to_avro_format "$schema_file")
    
    # 스키마 등록 요청
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/vnd.schemaregistry.v1+json" \
        -d @"$converted_schema" \
        "$SCHEMA_REGISTRY_URL/subjects/$subject_name/versions")
    
    # 임시 파일 정리
    rm -f "$converted_schema"
    
    # 응답 확인
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        local schema_id
        schema_id=$(echo "$response" | jq -r '.id')
        log_success "스키마 '$subject_name' 등록 완료 (ID: $schema_id)"
        return 0
    else
        log_error "스키마 '$subject_name' 등록 실패: $response"
        return 1
    fi
}

# 등록된 스키마 목록 조회 함수
list_registered_schemas() {
    log_info "등록된 스키마 목록:"
    local subjects
    subjects=$(curl -s "$SCHEMA_REGISTRY_URL/subjects")
    
    if [[ "$subjects" != "[]" ]]; then
        echo "$subjects" | jq -r '.[]' | while read -r subject; do
            local latest_version
            latest_version=$(curl -s "$SCHEMA_REGISTRY_URL/subjects/$subject/versions/latest")
            local version
            local id
            version=$(echo "$latest_version" | jq -r '.version')
            id=$(echo "$latest_version" | jq -r '.id')
            log_info "  - $subject (버전: $version, ID: $id)"
        done
    else
        log_warning "등록된 스키마가 없습니다."
    fi
}

# 스키마 호환성 확인 함수
check_schema_compatibility() {
    local subject_name=$1
    local schema_file=$2
    
    log_info "스키마 호환성 확인 중: $subject_name"
    
    local converted_schema
    converted_schema=$(convert_to_avro_format "$schema_file")
    
    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/vnd.schemaregistry.v1+json" \
        -d @"$converted_schema" \
        "$SCHEMA_REGISTRY_URL/compatibility/subjects/$subject_name/versions/latest")
    
    # 임시 파일 정리
    rm -f "$converted_schema"
    
    local is_compatible
    is_compatible=$(echo "$response" | jq -r '.is_compatible // false')
    
    if [[ "$is_compatible" == "true" ]]; then
        log_success "스키마 '$subject_name'은 호환됩니다."
        return 0
    else
        log_warning "스키마 '$subject_name'은 호환되지 않습니다: $response"
        return 1
    fi
}

# 메인 실행 함수
main() {
    log_info "=== Schema Registry 스키마 등록 시작 ==="
    log_info "TASK-6: Event Bus (Kafka) 설정"
    log_info "계약 기준: $CONTRACTS_DIR"
    
    # 필수 도구 확인
    if ! command -v curl &> /dev/null; then
        log_error "curl이 설치되어 있지 않습니다."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq가 설치되어 있지 않습니다."
        exit 1
    fi
    
    # Schema Registry 연결 확인
    if ! wait_for_schema_registry; then
        log_error "Schema Registry 서버에 연결할 수 없습니다."
        exit 1
    fi
    
    # 계약 디렉토리 존재 확인
    if [[ ! -d "$CONTRACTS_DIR" ]]; then
        log_error "계약 디렉토리를 찾을 수 없습니다: $CONTRACTS_DIR"
        exit 1
    fi
    
    # 이벤트 스키마 파일 정의 (TASK-2 계약 기반)
    declare -A SCHEMA_FILES=(
        ["device-events-value"]="$CONTRACTS_DIR/device-events.json"
        ["mcp-events-value"]="$CONTRACTS_DIR/mcp-events.json"
        ["llm-events-value"]="$CONTRACTS_DIR/llm-events.json"
        ["workflow-events-value"]="$CONTRACTS_DIR/workflow-events.json"
    )
    
    # 각 스키마 등록
    local success_count=0
    local total_count=${#SCHEMA_FILES[@]}
    
    for subject_name in "${!SCHEMA_FILES[@]}"; do
        schema_file="${SCHEMA_FILES[$subject_name]}"
        
        # 스키마 파일 존재 확인
        if [[ ! -f "$schema_file" ]]; then
            log_error "스키마 파일을 찾을 수 없습니다: $schema_file"
            continue
        fi
        
        # 기존 스키마가 있는 경우 호환성 확인
        if curl -s -f "$SCHEMA_REGISTRY_URL/subjects/$subject_name/versions/latest" > /dev/null 2>&1; then
            log_info "기존 스키마가 존재합니다. 호환성을 확인합니다."
            if ! check_schema_compatibility "$subject_name" "$schema_file"; then
                log_warning "호환성 문제로 인해 스키마 등록을 건너뜁니다: $subject_name"
                continue
            fi
        fi
        
        # 스키마 등록
        if register_schema "$subject_name" "$schema_file"; then
            ((success_count++))
        fi
    done
    
    echo
    log_info "=== 스키마 등록 결과 ==="
    log_success "$success_count/$total_count 스키마 등록 완료"
    
    # 등록된 스키마 목록 출력
    echo
    list_registered_schemas
    
    log_success "=== Schema Registry 스키마 등록 완료 ==="
}

# 스크립트 직접 실행 시
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
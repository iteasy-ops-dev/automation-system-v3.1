#!/bin/bash

# =======================================================
# 통합 자동화 시스템 v3.1 - 이식성 체크 스크립트
# =======================================================

set -e

echo "🔍 통합 자동화 시스템 v3.1 이식성 체크를 시작합니다..."
echo "=================================================="

# 체크 결과 저장
ISSUES=()
WARNINGS=()
SUCCESS=()

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    SUCCESS+=("$1")
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS+=("$1")
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ISSUES+=("$1")
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. 프로젝트 구조 검증
echo
echo "🏗️  프로젝트 구조 검증 중..."
echo "--------------------------------"

# 필수 디렉토리 체크
REQUIRED_DIRS=(
    "services/core/gateway"
    "services/storage" 
    "services/domain/device-management"
    "services/domain/mcp-integration"
    "services/domain/llm"
    "services/domain/workflow-engine"
    "frontend/main-app"
    "shared/contracts/v1.0"
    "infrastructure/scripts"
    "infrastructure/docker"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_success "디렉토리 존재: $dir"
    else
        log_error "필수 디렉토리 누락: $dir"
    fi
done

# 필수 파일 체크
REQUIRED_FILES=(
    "docker-compose.yml"
    ".env.example"
    "package.json"
    "README.md"
    "shared/contracts/v1.0/README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "파일 존재: $file"
    else
        log_error "필수 파일 누락: $file"
    fi
done

# 2. 계약 파일 검증
echo
echo "📋 계약 파일 검증 중..."
echo "----------------------"

# REST API 계약 파일
REST_CONTRACTS=(
    "shared/contracts/v1.0/rest/core/gateway-auth.yaml"
    "shared/contracts/v1.0/rest/core/gateway-proxy.yaml"
    "shared/contracts/v1.0/rest/core/storage-api.yaml"
    "shared/contracts/v1.0/rest/core/storage-auth.yaml"
    "shared/contracts/v1.0/rest/domain/device-service.yaml"
    "shared/contracts/v1.0/rest/domain/mcp-service.yaml"
    "shared/contracts/v1.0/rest/domain/llm-service.yaml"
    "shared/contracts/v1.0/rest/domain/workflow-service.yaml"
)

# 이벤트 계약 파일
EVENT_CONTRACTS=(
    "shared/contracts/v1.0/events/device-events.json"
    "shared/contracts/v1.0/events/mcp-events.json"
    "shared/contracts/v1.0/events/llm-events.json"
    "shared/contracts/v1.0/events/workflow-events.json"
    "shared/contracts/v1.0/events/websocket-messages.json"
)

# REST 계약 체크
for contract in "${REST_CONTRACTS[@]}"; do
    if [ -f "$contract" ]; then
        log_success "REST 계약: $contract"
    else
        log_error "REST 계약 누락: $contract"
    fi
done

# 이벤트 계약 체크
for contract in "${EVENT_CONTRACTS[@]}"; do
    if [ -f "$contract" ]; then
        log_success "이벤트 계약: $contract"
    else
        log_error "이벤트 계약 누락: $contract"
    fi
done

# 3. Docker 설정 검증
echo
echo "🐳 Docker 설정 검증 중..."
echo "-------------------------"

# Docker Compose 서비스 체크
if [ -f "docker-compose.yml" ]; then
    # 핵심 서비스 체크
    CORE_SERVICES=("gateway" "storage")
    DOMAIN_SERVICES=("device-service" "mcp-service" "llm-service" "workflow-engine")
    DATA_STORES=("postgres" "mongodb" "redis" "influxdb" "minio")
    FRONTEND_APPS=("main-app")
    
    for service in "${CORE_SERVICES[@]}"; do
        if grep -q "^\s*${service}:" docker-compose.yml; then
            log_success "Core Service: $service"
        else
            log_error "Core Service 누락: $service"
        fi
    done
    
    for service in "${DOMAIN_SERVICES[@]}"; do
        if grep -q "^\s*${service}:" docker-compose.yml; then
            log_success "Domain Service: $service"
        else
            log_error "Domain Service 누락: $service"
        fi
    done
    
    for service in "${DATA_STORES[@]}"; do
        if grep -q "^\s*${service}:" docker-compose.yml; then
            log_success "Data Store: $service"
        else
            log_error "Data Store 누락: $service"
        fi
    done
    
    for service in "${FRONTEND_APPS[@]}"; do
        if grep -q "^\s*${service}:" docker-compose.yml; then
            log_success "Frontend App: $service"
        else
            log_warning "Frontend App 선택적: $service"
        fi
    done
fi

# 4. 환경 설정 검증
echo
echo "⚙️  환경 설정 검증 중..."
echo "----------------------"

if [ -f ".env.example" ]; then
    # 필수 환경 변수 체크
    REQUIRED_ENV_VARS=(
        "NODE_ENV"
        "JWT_SECRET"
        "POSTGRES_PASSWORD"
        "MONGO_ROOT_PASSWORD"
        "REDIS_PASSWORD"
        "INFLUXDB_TOKEN"
        "MINIO_ROOT_USER"
        "MINIO_ROOT_PASSWORD"
    )
    
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if grep -q "^${var}=" .env.example; then
            log_success "환경 변수: $var"
        else
            log_error "필수 환경 변수 누락: $var"
        fi
    done
    
    # .env 파일 존재 체크
    if [ -f ".env" ]; then
        log_success ".env 파일 존재"
    else
        log_warning ".env 파일 없음 (.env.example에서 복사 필요)"
    fi
else
    log_error ".env.example 파일이 없습니다"
fi

# 5. 의존성 체크
echo
echo "📦 의존성 체크 중..."
echo "-------------------"

# package.json 스크립트 체크
if [ -f "package.json" ]; then
    REQUIRED_SCRIPTS=(
        "dev"
        "build"
        "test"
        "contracts:validate"
        "health"
    )
    
    for script in "${REQUIRED_SCRIPTS[@]}"; do
        if grep -q "\"${script}\":" package.json; then
            log_success "npm 스크립트: $script"
        else
            log_error "npm 스크립트 누락: $script"
        fi
    done
fi

# node_modules 체크
if [ -d "node_modules" ]; then
    log_success "node_modules 존재"
else
    log_warning "node_modules 없음 (npm install 필요)"
fi

# 6. 서비스별 Dockerfile 체크
echo
echo "🔧 서비스별 Dockerfile 체크 중..."
echo "--------------------------------"

SERVICE_DIRS=(
    "services/core/gateway"
    "services/storage"
    "services/domain/device-management"
    "services/domain/mcp-integration"
    "services/domain/llm"
    "services/domain/workflow-engine"
    "frontend/main-app"
)

for service_dir in "${SERVICE_DIRS[@]}"; do
    if [ -f "${service_dir}/Dockerfile" ]; then
        log_success "Dockerfile: $service_dir"
    else
        log_error "Dockerfile 누락: $service_dir"
    fi
    
    if [ -f "${service_dir}/package.json" ]; then
        log_success "package.json: $service_dir"
    else
        log_warning "package.json 없음: $service_dir"
    fi
done

# 7. 네트워크 독립성 체크
echo
echo "🌐 네트워크 독립성 체크 중..."
echo "----------------------------"

# 하드코딩된 IP 주소나 로컬 경로 체크
if grep -r "localhost" docker-compose.yml > /dev/null 2>&1; then
    log_warning "docker-compose.yml에 localhost 참조 발견"
fi

if grep -r "127.0.0.1" docker-compose.yml > /dev/null 2>&1; then
    log_warning "docker-compose.yml에 127.0.0.1 참조 발견"
fi

# 절대 경로 체크
if grep -r "/Users/" docker-compose.yml > /dev/null 2>&1; then
    log_error "docker-compose.yml에 절대 경로 발견 (이식성 문제)"
fi

if grep -r "/home/" docker-compose.yml > /dev/null 2>&1; then
    log_error "docker-compose.yml에 절대 경로 발견 (이식성 문제)"
fi

# 8. 포트 충돌 가능성 체크
echo
echo "🔌 포트 사용 현황 체크 중..."
echo "----------------------------"

USED_PORTS=(80 443 3001 3002 3003 5432 6379 8001 8080 8086 8101 8201 8301 8401 9000 9001 9092 27017)

log_info "사용 중인 포트: ${USED_PORTS[*]}"
log_info "새 환경에서는 이 포트들이 사용 가능한지 확인하세요"

# 9. 계약 검증 실행
echo
echo "✅ 계약 검증 실행 중..."
echo "----------------------"

if command -v node > /dev/null 2>&1 && [ -f "infrastructure/scripts/validate-contracts.js" ]; then
    if npm run contracts:validate > /dev/null 2>&1; then
        log_success "모든 계약이 유효합니다"
    else
        log_error "계약 검증 실패"
    fi
else
    log_warning "계약 검증 도구를 실행할 수 없습니다 (Node.js 또는 스크립트 누락)"
fi

# 10. 최종 결과 보고서
echo
echo "📊 최종 이식성 보고서"
echo "===================="

echo
echo -e "${GREEN}✅ 성공 항목 (${#SUCCESS[@]}개):${NC}"
for item in "${SUCCESS[@]}"; do
    echo "  • $item"
done

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo
    echo -e "${YELLOW}⚠️  경고 항목 (${#WARNINGS[@]}개):${NC}"
    for item in "${WARNINGS[@]}"; do
        echo "  • $item"
    done
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
    echo
    echo -e "${RED}❌ 문제 항목 (${#ISSUES[@]}개):${NC}"
    for item in "${ISSUES[@]}"; do
        echo "  • $item"
    done
fi

# 이식성 점수 계산
TOTAL_CHECKS=$((${#SUCCESS[@]} + ${#WARNINGS[@]} + ${#ISSUES[@]}))
SUCCESS_RATE=$(( ${#SUCCESS[@]} * 100 / TOTAL_CHECKS ))

echo
echo "📈 이식성 점수: ${SUCCESS_RATE}%"

# 이식성 등급 결정
if [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}🏆 등급: EXCELLENT - 다른 시스템으로 이식 준비 완료${NC}"
    GRADE="EXCELLENT"
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}🥈 등급: GOOD - 일부 수정 후 이식 가능${NC}"
    GRADE="GOOD"
elif [ $SUCCESS_RATE -ge 70 ]; then
    echo -e "${YELLOW}🥉 등급: FAIR - 여러 수정 필요${NC}"
    GRADE="FAIR"
else
    echo -e "${RED}💥 등급: POOR - 대규모 수정 필요${NC}"
    GRADE="POOR"
fi

# 권장 사항
echo
echo "💡 이식 시 권장 사항:"
echo "====================="
echo "1. 새 환경에서 .env.example을 .env로 복사 후 값 수정"
echo "2. 포트 충돌 확인 및 필요시 docker-compose.yml 포트 변경"
echo "3. npm install로 의존성 설치"
echo "4. npm run setup으로 초기 설정"
echo "5. npm run dev로 시스템 시작"
echo "6. npm run health로 상태 확인"

# 종료 코드 결정
if [ $SUCCESS_RATE -ge 80 ]; then
    echo
    echo -e "${GREEN}🎉 시스템이 다른 환경으로 이식 가능합니다!${NC}"
    exit 0
else
    echo
    echo -e "${RED}🚨 이식 전에 문제 사항을 수정해야 합니다.${NC}"
    exit 1
fi

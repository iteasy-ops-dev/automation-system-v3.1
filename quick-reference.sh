#!/bin/bash
# quick-reference.sh - 빠른 참조 가이드

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================="
echo "  통합 자동화 시스템 v3.1 - 빠른 참조"
echo "========================================="
echo ""

echo -e "${BLUE}🚀 시스템 관리 명령어${NC}"
echo "----------------------------------------"
echo "기본 시작:        docker-compose up -d"
echo "안전한 시작:      ./start-system-safe.sh"
echo "시스템 중지:      docker-compose down"
echo "서비스 재시작:    docker-compose restart [service-name]"
echo "전체 재빌드:      docker-compose build && docker-compose up -d"
echo ""

echo -e "${BLUE}📦 백업 및 복원${NC}"
echo "----------------------------------------"
echo "완전한 백업:      ./create-safe-backup.sh"
echo "빠른 DB 백업:     ./scripts/quick-db-backup.sh"
echo "백업 복원:        cd backups/[BACKUP_ID] && ./restore-safe-backup.sh"
echo "최신 백업 확인:   cat backups/latest-backup.txt"
echo ""

echo -e "${BLUE}🔧 스키마 관리${NC}"
echo "----------------------------------------"
echo "수동 마이그레이션: ./scripts/manual-migration.sh"
echo "스키마 검증:      ./scripts/manual-migration.sh (옵션 3)"
echo ""

echo -e "${BLUE}📊 모니터링 및 디버깅${NC}"
echo "----------------------------------------"
echo "서비스 상태:      docker ps | grep automation"
echo "서비스 로그:      docker logs -f automation-[service-name]"
echo "헬스체크:         curl http://localhost:8080/api/v1/system/health"
echo "로그인 테스트:    curl -X POST http://localhost:8080/api/v1/auth/login \\"
echo "                  -H 'Content-Type: application/json' \\"
echo "                  -d '{\"username\": \"admin\", \"password\": \"Admin123!@#\"}'"
echo ""

echo -e "${BLUE}🌐 접속 정보${NC}"
echo "----------------------------------------"
echo "Frontend:         http://localhost:3001"
echo "API Gateway:      http://localhost:8080"
echo "로그인:           admin / Admin123!@#"
echo ""

echo -e "${BLUE}🗄️ 데이터베이스 직접 접근${NC}"
echo "----------------------------------------"
echo "PostgreSQL:       docker exec -it automation-postgres psql -U postgres -d automation"
echo "MongoDB:          docker exec -it automation-mongodb mongosh automation \\"
echo "                  --username admin --password automation_mongo_pass_2024"
echo "Redis:            docker exec -it automation-redis redis-cli -a automation_redis_pass_2024"
echo ""

echo -e "${BLUE}⚠️ 중요 사항${NC}"
echo "----------------------------------------"
echo "• 자동 스키마 수정 비활성화됨 (데이터 안전)"
echo "• 스키마 변경은 수동으로만 가능"
echo "• 중요한 작업 전 반드시 백업"
echo "• 볼륨 삭제 금지: docker-compose down -v"
echo ""

echo -e "${YELLOW}📋 문제 해결 체크리스트${NC}"
echo "----------------------------------------"
echo "1. 모든 서비스 실행 중? → docker ps | grep automation"
echo "2. 로그에 에러? → docker logs automation-[service-name]"
echo "3. 네트워크 연결? → curl http://localhost:8080/"
echo "4. 스키마 문제? → ./scripts/manual-migration.sh"
echo "5. 데이터 문제? → 백업에서 복원"
echo ""

echo "========================================="
echo -e "${GREEN}✅ 모든 명령어가 준비되었습니다!${NC}"
echo "========================================="

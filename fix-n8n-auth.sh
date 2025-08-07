#!/bin/bash
# fix-n8n-auth.sh

echo "🔧 n8n 인증 문제 해결 스크립트"

cd /Users/leesg/Documents/work_ops/automation-system

echo -e "\n1. n8n 컨테이너 재구성..."

# docker-compose.yml 백업
cp docker-compose.yml docker-compose.yml.backup

# n8n 서비스만 재시작
docker-compose stop n8n

echo -e "\n2. n8n 설정 업데이트..."

# n8n 환경변수 수정 (USER_MANAGEMENT 비활성화)
cat > n8n-env-override.txt << 'EOF'
# n8n 환경변수 수정사항
# N8N_USER_MANAGEMENT_DISABLED를 true로 변경
# Basic Auth만 사용하도록 설정
EOF

echo "docker-compose.yml에서 n8n 설정을 다음과 같이 수정해야 합니다:"
echo "  - N8N_USER_MANAGEMENT_DISABLED=true  # false에서 true로 변경"
echo ""
echo "수정 후 다음 명령어 실행:"
echo "  docker-compose up -d n8n"

echo -e "\n3. 현재 n8n 데이터 확인..."
docker exec automation-n8n sh -c "ls -la /home/node/.n8n/ 2>/dev/null || echo 'No n8n data directory found'"

echo -e "\n✅ 다음 단계:"
echo "1. docker-compose.yml 수정"
echo "2. docker-compose up -d n8n"
echo "3. curl -u admin:Admin123!@# http://localhost:5678/rest/workflows"

#!/bin/bash
# 통합 자동화 시스템 v3.1 - 안전한 백업 스크립트
# 자동 스키마 수정 비활성화 버전

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
BACKUP_ID="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/$BACKUP_ID"

echo ""
echo "========================================="
echo "  통합 자동화 시스템 v3.1 - 안전한 백업"
echo "========================================="
echo "백업 ID: $BACKUP_ID"
echo "프
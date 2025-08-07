#!/bin/bash
# 통합 자동화 시스템 v3.1 - 완전한 백업 스크립트
# n8n workflow engine 포함한 모든 마이크로서비스 백업

set -e
PROJECT_DIR="/Users/leesg/Documents/work_ops/automation-system"
BACKUP_ID="v31_$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/$BACKUP_ID"

echo "🚀 통합 자동화 시스템 v3.1 완전한 백업 시작: $BACKUP_ID"
echo "📅 백업 시작 시간: $(date)"
echo "📁 프로젝트 위치: $PROJECT_DIR"
echo "💾 백업 위치: $BACKUP_DIR"
echo ""

# 백
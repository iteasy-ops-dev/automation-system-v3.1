#!/bin/bash

# API 키를 환경변수로 설정하는 스크립트
# 사용법: ./update-env.sh

echo "LLM API 키 설정 스크립트"
echo "========================"

# OpenAI API 키 입력
read -p "OpenAI API 키를 입력하세요 (없으면 Enter): " OPENAI_KEY
if [ ! -z "$OPENAI_KEY" ]; then
    sed -i '' "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" .env
    echo "✅ OpenAI API 키 설정됨"
fi

# Anthropic API 키 입력
read -p "Anthropic API 키를 입력하세요 (없으면 Enter): " ANTHROPIC_KEY
if [ ! -z "$ANTHROPIC_KEY" ]; then
    sed -i '' "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" .env
    echo "✅ Anthropic API 키 설정됨"
fi

echo ""
echo "설정이 완료되었습니다. LLM Service를 재시작합니다..."
docker-compose restart llm-service

echo "✅ 완료!"

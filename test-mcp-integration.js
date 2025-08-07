#!/usr/bin/env node

// MCP 통합 테스트 스크립트
const axios = require('axios');

const GATEWAY_URL = 'http://localhost:8080';

async function testMCPIntegration() {
  console.log('🔧 MCP 통합 테스트 시작...\n');

  try {
    // 1. 로그인
    console.log('1️⃣ 로그인 시도...');
    const loginResponse = await axios.post(`${GATEWAY_URL}/api/v1/auth/login`, {
      username: 'admin',
      password: 'Admin123!@#'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ 로그인 성공\n');

    // 2. 채팅 세션 생성
    console.log('2️⃣ 채팅 세션 생성...');
    const sessionResponse = await axios.post(`${GATEWAY_URL}/api/v1/chat/sessions`, {
      name: 'MCP 통합 테스트'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const sessionId = sessionResponse.data.id;
    console.log(`✅ 세션 생성: ${sessionId}\n`);

    // 3. 서버 상태 확인 메시지 (MCP 통합 테스트)
    console.log('3️⃣ MCP 통합 테스트: "서버 상태 확인해줘"');
    const chatResponse = await axios.post(`${GATEWAY_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
      content: '서버 상태 확인해줘',
      type: 'infrastructure'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('📝 응답:');
    console.log(`Status: ${chatResponse.data.status}`);
    console.log(`Response: ${chatResponse.data.response}`);
    console.log(`Execution ID: ${chatResponse.data.executionId}`);
    
    if (chatResponse.data.results) {
      console.log(`\n🔍 MCP 실행 결과 (${chatResponse.data.results.length}개):`);
      chatResponse.data.results.forEach((result, index) => {
        console.log(`  ${index + 1}. Type: ${result.type}`);
        if (result.deviceName) {
          console.log(`     Device: ${result.deviceName} (${result.host})`);
        }
        if (result.message) {
          console.log(`     Message: ${result.message}`);
        }
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
    }

    // 4. 간단한 계산 테스트 (기존 기능 확인)
    console.log('\n4️⃣ 기본 기능 테스트: "5 + 3"');
    const calcResponse = await axios.post(`${GATEWAY_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
      content: '5 + 3',
      type: 'calculation'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('📝 계산 응답:');
    console.log(`Response: ${calcResponse.data.response}`);

    console.log('\n✅ 모든 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

// 실행
if (require.main === module) {
  testMCPIntegration();
}

module.exports = testMCPIntegration;
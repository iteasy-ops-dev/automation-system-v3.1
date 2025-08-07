#!/usr/bin/env node
const axios = require('axios');

/**
 * Gateway를 통한 Device API 테스트
 */
async function testGatewayDeviceAPI() {
  console.log('🔍 Gateway Device API 테스트 시작...\n');

  const GATEWAY_URL = 'http://localhost:8080';
  const USERNAME = 'admin';
  const PASSWORD = 'Admin123!@#';  // 올바른 비밀번호

  try {
    // 1. 로그인하여 토큰 획득
    console.log('1️⃣ 로그인 시도...');
    const loginRes = await axios.post(`${GATEWAY_URL}/api/v1/auth/login`, {
      username: USERNAME,
      password: PASSWORD
    });

    const { accessToken } = loginRes.data;
    console.log('✅ 로그인 성공! 토큰 획득');
    console.log(`   전체 토큰: ${accessToken}`);
    console.log(`   사용자: ${loginRes.data.user?.username || 'N/A'}`);

    // 2. Device API 호출
    console.log('\n2️⃣ Gateway를 통한 Device API 호출...');
    console.log(`   URL: ${GATEWAY_URL}/api/v1/devices`);
    
    const deviceRes = await axios.get(`${GATEWAY_URL}/api/v1/devices`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('✅ Device API 호출 성공!');
    console.log('   응답 아이템 수:', deviceRes.data.items?.length || 0);

    // 3. MCP Service 테스트
    console.log('\n3️⃣ Gateway를 통한 MCP Service 호출...');
    console.log(`   URL: ${GATEWAY_URL}/api/v1/mcp/servers`);
    
    const mcpRes = await axios.get(`${GATEWAY_URL}/api/v1/mcp/servers`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('✅ MCP Service API 호출 성공!');
    console.log('   응답:', JSON.stringify(mcpRes.data, null, 2));

    console.log('\n🎉 모든 테스트 통과! Gateway 프록시가 정상 작동합니다.');


  } catch (error) {
    console.error('\n❌ 테스트 실패!');
    if (error.response) {
      console.error('   상태 코드:', error.response.status);
      console.error('   에러 메시지:', error.response.data);
      console.error('   요청 URL:', error.config?.url);
      console.error('   요청 헤더:', error.config?.headers);
    } else {
      console.error('   에러:', error.message);
    }
    process.exit(1);
  }
}

// 실행
testGatewayDeviceAPI();

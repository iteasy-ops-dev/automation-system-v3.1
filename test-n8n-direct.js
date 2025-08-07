const axios = require('axios');

const n8nUrl = 'http://localhost:5678';
const auth = {
  username: 'admin',
  password: 'automation_n8n_pass_2024'
};

async function testN8nAPI() {
  console.log('🧪 n8n API 직접 테스트...\n');
  
  try {
    // 1. 홈페이지 접근 테스트
    console.log('1. n8n 홈페이지 접근...');
    const homeResponse = await axios.get(n8nUrl, { 
      auth,
      validateStatus: () => true 
    });
    console.log(`   Status: ${homeResponse.status}`);
    
    // 2. API 엔드포인트 테스트
    const endpoints = [
      '/api/v1',
      '/rest/workflows',
      '/rest/executions',
      '/api/v1/workflows',
      '/api/v1/executions'
    ];
    
    console.log('\n2. API 엔드포인트 테스트...');
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${n8nUrl}${endpoint}`, {
          auth,
          validateStatus: () => true
        });
        console.log(`   ${endpoint}: ${response.status} - ${response.statusText}`);
        
        if (response.status === 200) {
          console.log(`      ✅ 성공! 데이터 타입: ${typeof response.data}`);
          if (Array.isArray(response.data)) {
            console.log(`      배열 길이: ${response.data.length}`);
          }
        }
      } catch (error) {
        console.log(`   ${endpoint}: 오류 - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('테스트 실패:', error.message);
  }
}

testN8nAPI();

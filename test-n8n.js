const n8nEngine = require('./src/services/n8n-engine.service');

console.log('🔍 N8n Engine 테스트 시작...');

async function testN8nConnection() {
  try {
    console.log('📡 연결 테스트 중...');
    const result = await n8nEngine.testConnection();
    console.log('✅ 연결 성공:', JSON.stringify(result, null, 2));
    
    console.log('📋 워크플로우 목록 조회 테스트...');
    const workflows = await n8nEngine.getWorkflows();
    console.log('📋 워크플로우 목록:', JSON.stringify(workflows, null, 2));
    
  } catch (error) {
    console.error('❌ 연결 실패:', error.message);
    console.error('❌ 스택:', error.stack);
  }
}

testN8nConnection();

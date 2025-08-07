const n8nEngine = require("/app/src/services/n8n-engine.service");

async function testWithApiKey() {
  try {
    console.log("🔑 API Key 인증으로 워크플로우 생성 테스트...");
    
    const testWorkflow = {
      name: "test-workflow-final",
      description: "최종 API Key 테스트", 
      nodes: [{
        id: "manual-trigger",
        type: "manualTrigger",
        typeVersion: 1,
        position: [250, 300]
      }],
      connections: {}
    };
    
    const result = await n8nEngine.createWorkflow(testWorkflow);
    console.log("✅ 워크플로우 생성 성공:", JSON.stringify(result, null, 2));
    
    if (result.id) {
      console.log("🚀 워크플로우 실행 테스트...");
      const execResult = await n8nEngine.executeWorkflow(result.id, {test: true});
      console.log("✅ 워크플로우 실행 성공:", JSON.stringify(execResult, null, 2));
    }
    
  } catch (error) {
    console.error("❌ 테스트 실패:", error.message);
    if (error.response?.data) {
      console.error("상세 응답:", JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error("HTTP 상태:", error.response.status);  
    }
  }
}

testWithApiKey();

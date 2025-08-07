const n8nEngine = require("/app/src/services/n8n-engine.service");

console.log("🔍 N8n Engine 디버그 정보:");
console.log("- API Key:", n8nEngine.apiKey ? "✅ 설정됨" : "❌ 없음");
console.log("- Base URL:", n8nEngine.baseUrl);
console.log("- Basic Auth:", n8nEngine.basicAuth);

// 실제 환경변수 확인
console.log("🌍 환경변수 직접 확인:");
console.log("- N8N_API_KEY:", process.env.N8N_API_KEY ? "✅ 설정됨" : "❌ 없음");
console.log("- N8N_API_URL:", process.env.N8N_API_URL);

// 헤더 확인
console.log("🔧 클라이언트 헤더:");
console.log(JSON.stringify(n8nEngine.client.defaults.headers, null, 2));

if (n8nEngine.client.defaults.auth) {
    console.log("🔐 Basic Auth 설정:", n8nEngine.client.defaults.auth);
}

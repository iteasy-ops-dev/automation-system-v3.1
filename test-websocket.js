#!/usr/bin/env node

/**
 * WebSocket 연결 테스트 스크립트
 */

const WebSocket = require('ws');

const token = process.argv[2];
if (!token) {
  console.error('Usage: node test-websocket.js <JWT_TOKEN>');
  process.exit(1);
}

console.log('🔌 Connecting to WebSocket...');

const ws = new WebSocket('ws://localhost:8080/ws', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  
  // 테스트 메시지 전송
  setTimeout(() => {
    console.log('📤 Sending test message...');
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    }));
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Received message:', message);
    
    if (message.type === 'workflow_progress') {
      console.log('🔄 Workflow Progress:', message.payload);
    } else if (message.type === 'chat_response') {
      console.log('💬 Chat Response:', message.payload);
    } else if (message.type === 'execution_update') {
      console.log('⚡ Execution Update:', message.payload);
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔚 WebSocket closed. Code: ${code}, Reason: ${reason}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing WebSocket connection...');
  ws.close();
  process.exit(0);
});

console.log('📡 Listening for messages... Press Ctrl+C to exit.');

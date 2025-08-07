// WebSocket 인증 테스트 스크립트
// 브라우저 콘솔에서 실행하세요

// 1. 토큰 확인
const token = localStorage.getItem('auth_access_token');
console.log('Token exists:', !!token);
console.log('Token preview:', token ? `${token.substring(0, 30)}...` : 'N/A');

// 2. WebSocket 연결 테스트
if (window.websocketService) {
  console.log('WebSocket Service found');
  
  // 현재 상태 확인
  const state = window.websocketService.getState();
  console.log('Current state:', state);
  
  // 연결 시도
  console.log('Attempting to connect...');
  window.websocketService.connect();
  
  // 상태 변화 모니터링
  setTimeout(() => {
    const newState = window.websocketService.getState();
    console.log('State after connection attempt:', newState);
  }, 3000);
} else {
  console.error('WebSocket Service not found. Make sure you are in development mode.');
}

// 3. 직접 Socket.IO 연결 테스트 (디버깅용)
import('socket.io-client').then(({ io }) => {
  const directSocket = io('http://localhost:8080', {
    path: '/ws',
    transports: ['websocket', 'polling'],
    auth: {
      token: token
    },
    extraHeaders: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  directSocket.on('connect', () => {
    console.log('Direct connection successful!');
  });
  
  directSocket.on('connect_error', (error) => {
    console.error('Direct connection error:', error.message);
  });
  
  directSocket.on('message', (msg) => {
    console.log('Received message:', msg);
  });
});

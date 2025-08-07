// 브라우저 Console에서 실행할 수 있는 디버깅 스크립트
console.log('🔍 Chat 디버깅 시작');

// 현재 페이지가 Chat 페이지인지 확인
if (window.location.pathname.includes('/chat')) {
    console.log('✅ Chat 페이지 감지됨');
    
    // React DevTools가 있는지 확인
    if (window.React) {
        console.log('✅ React 감지됨');
    }
    
    // 로컬 스토리지에서 토큰 확인
    const token = localStorage.getItem('auth-token') || 
                  localStorage.getItem('authToken') ||
                  sessionStorage.getItem('auth-token');
    
    if (token) {
        console.log('✅ 인증 토큰 발견:', token.substring(0, 20) + '...');
        
        // 직접 API 테스트
        fetch('/api/v1/workflows/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId: '550e8400-e29b-41d4-a716-446655440001',
                message: '브라우저 디버그 테스트'
            })
        })
        .then(response => {
            console.log('🔍 API Response Status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('🔍 API Response Data:', data);
            
            if (data.message) {
                console.log('✅ Message 필드 존재:', data.message);
            } else {
                console.log('❌ Message 필드 없음');
                console.log('📊 Available fields:', Object.keys(data));
            }
        })
        .catch(error => {
            console.error('❌ API 에러:', error);
        });
        
    } else {
        console.log('❌ 인증 토큰 없음 - 로그인 필요');
    }
    
} else {
    console.log('⚠️ Chat 페이지가 아님:', window.location.pathname);
}

// Zustand store 상태 확인 (가능한 경우)
setTimeout(() => {
    if (window.__ZUSTAND_STORES__) {
        console.log('🗄️ Zustand stores:', window.__ZUSTAND_STORES__);
    }
}, 1000);
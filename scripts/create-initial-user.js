#!/usr/bin/env node

/**
 * 초기 사용자 생성 스크립트
 * 통합 자동화 시스템 v3.1
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// 데이터베이스 연결 설정
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'automation',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'automation_postgres_pass_2024'
});

// 초기 사용자 정보
const initialUsers = [
  {
    username: 'admin',
    email: 'admin@automation.local',
    password: 'Admin123!@#',
    full_name: 'System Administrator',
    role: 'admin'
  },
  {
    username: 'demo',
    email: 'demo@automation.local',
    password: 'Demo123!@#',
    full_name: 'Demo User',
    role: 'user'
  }
];

async function createInitialUsers() {
  console.log('🚀 초기 사용자 생성 시작...');
  
  try {
    // 데이터베이스 연결 테스트
    await pool.query('SELECT NOW()');
    console.log('✅ 데이터베이스 연결 성공');
    
    for (const user of initialUsers) {
      try {
        // 사용자 존재 여부 확인
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE username = $1 OR email = $2',
          [user.username, user.email]
        );
        
        if (existingUser.rows.length > 0) {
          console.log(`⏭️  사용자 '${user.username}' 이미 존재함`);
          continue;
        }
        
        // 비밀번호 해시 생성
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(user.password, salt);
        
        // 사용자 생성
        const result = await pool.query(
          `INSERT INTO users (username, email, password_hash, full_name, role, status) 
           VALUES ($1, $2, $3, $4, $5, 'active') 
           RETURNING id, username, email, full_name, role`,
          [user.username, user.email, passwordHash, user.full_name, user.role]
        );
        
        console.log(`✅ 사용자 생성 완료:`, {
          username: result.rows[0].username,
          email: result.rows[0].email,
          role: result.rows[0].role
        });
        
      } catch (error) {
        console.error(`❌ 사용자 '${user.username}' 생성 실패:`, error.message);
      }
    }
    
    // 생성된 사용자 목록 확인
    const users = await pool.query(
      'SELECT id, username, email, full_name, role, status FROM users ORDER BY created_at'
    );
    
    console.log('\n📋 전체 사용자 목록:');
    console.table(users.rows);
    
    console.log('\n🎉 초기 사용자 생성 완료!');
    console.log('\n로그인 정보:');
    console.log('- 관리자: admin / Admin123!@#');
    console.log('- 데모 사용자: demo / Demo123!@#');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 스크립트 실행
createInitialUsers();

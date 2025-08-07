#!/usr/bin/env node
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

/**
 * 테스트용 관리자 계정 생성
 */
async function createTestUser() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:postgres@localhost:5432/automation'
      }
    }
  });

  try {
    console.log('🔧 테스트 사용자 생성 시작...');

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    console.log('✅ 사용자 생성 완료:', {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status
    });

  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️ 사용자가 이미 존재합니다.');
    } else {
      console.error('❌ 사용자 생성 실패:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
createTestUser();

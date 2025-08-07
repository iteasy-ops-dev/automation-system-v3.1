import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing Prisma connection...');
    
    // 데이터베이스 연결 테스트
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // 기본 쿼리 테스트
    const userCount = await prisma.user.count();
    console.log(`✅ Users count: ${userCount}`);
    
    const deviceCount = await prisma.device.count();
    console.log(`✅ Devices count: ${deviceCount}`);
    
    const mcpServerCount = await prisma.mcpServer.count();
    console.log(`✅ MCP Servers count: ${mcpServerCount}`);
    
    console.log('🎉 Prisma is working perfectly!');
    
  } catch (error) {
    console.error('❌ Prisma connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

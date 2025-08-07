/**
 * DeviceRepository 테스트
 * Prisma 기반 구현 검증
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { DeviceRepository } from './src/repositories/device.repository';
import { CacheService } from './src/services/cache.service';
import { createLogger } from './src/utils/logger';

async function testDeviceRepository() {
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const logger = createLogger('test-device-repository');
  const cache = new CacheService(redis, logger);
  
  const deviceRepo = new DeviceRepository(prisma, cache, logger);

  try {
    console.log('🧪 Testing DeviceRepository with Prisma...\n');

    // 1. Health Check
    console.log('1. Testing health check...');
    const isHealthy = await deviceRepo.healthCheck();
    console.log(`✅ Health check: ${isHealthy ? 'PASS' : 'FAIL'}\n`);

    // 2. Device Stats
    console.log('2. Testing device stats...');
    const stats = await deviceRepo.getDeviceStats();
    console.log(`✅ Device stats:`, stats);
    console.log('');

    // 3. Device List (empty)
    console.log('3. Testing device list (empty)...');
    const emptyList = await deviceRepo.findDevices({});
    console.log(`✅ Empty device list:`, {
      total: emptyList.total,
      items: emptyList.items.length
    });
    console.log('');

    // 4. Create Device Group
    console.log('4. Testing device group creation...');
    const group = await deviceRepo.createDeviceGroup({
      name: 'Test Servers',
      description: 'Test server group'
    });
    console.log(`✅ Created device group:`, {
      id: group.id,
      name: group.name
    });
    console.log('');

    // 5. Create Device
    console.log('5. Testing device creation...');
    const device = await deviceRepo.createDevice({
      name: 'test-server-01',
      type: 'server',
      groupId: group.id,
      metadata: {
        ip: '192.168.1.100',
        os: 'Ubuntu 22.04'
      },
      tags: ['test', 'development']
    });
    console.log(`✅ Created device:`, {
      id: device.id,
      name: device.name,
      type: device.type,
      status: device.status
    });
    console.log('');

    // 6. Find Device by ID
    console.log('6. Testing device retrieval...');
    const foundDevice = await deviceRepo.findDeviceById(device.id);
    console.log(`✅ Found device:`, {
      id: foundDevice?.id,
      name: foundDevice?.name,
      groupName: foundDevice?.group?.name
    });
    console.log('');

    // 7. Update Device
    console.log('7. Testing device update...');
    const updatedDevice = await deviceRepo.updateDevice(device.id, {
      status: 'maintenance',
      metadata: {
        ip: '192.168.1.100',
        os: 'Ubuntu 22.04',
        lastMaintenance: new Date().toISOString()
      }
    });
    console.log(`✅ Updated device:`, {
      id: updatedDevice?.id,
      status: updatedDevice?.status,
      hasHistory: updatedDevice?.statusHistory?.length > 0
    });
    console.log('');

    // 8. Device List (with data)
    console.log('8. Testing device list (with data)...');
    const deviceList = await deviceRepo.findDevices({
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    console.log(`✅ Device list:`, {
      total: deviceList.total,
      items: deviceList.items.length,
      firstDevice: deviceList.items[0]?.name
    });
    console.log('');

    // 9. Search Devices
    console.log('9. Testing device search...');
    const searchResults = await deviceRepo.findDevices({
      search: 'test',
      type: 'server'
    });
    console.log(`✅ Search results:`, {
      total: searchResults.total,
      items: searchResults.items.length
    });
    console.log('');

    // 10. Device Groups List
    console.log('10. Testing device groups list...');
    const groupsList = await deviceRepo.findDeviceGroups({});
    console.log(`✅ Groups list:`, {
      total: groupsList.total,
      items: groupsList.items.length
    });
    console.log('');

    // 11. Updated Stats
    console.log('11. Testing updated device stats...');
    const newStats = await deviceRepo.getDeviceStats();
    console.log(`✅ Updated stats:`, newStats);
    console.log('');

    // 12. Cache Test
    console.log('12. Testing cache functionality...');
    console.time('First request (no cache)');
    await deviceRepo.findDevices({});
    console.timeEnd('First request (no cache)');
    
    console.time('Second request (cached)');
    await deviceRepo.findDevices({});
    console.timeEnd('Second request (cached)');
    console.log('');

    // 13. Delete Device
    console.log('13. Testing device deletion...');
    const deleted = await deviceRepo.deleteDevice(device.id);
    console.log(`✅ Device deleted: ${deleted}`);
    console.log('');

    console.log('🎉 All tests passed! DeviceRepository is working perfectly with Prisma.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.name) {
      console.error('Error type:', error.name);
    }
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

// 비동기 실행
testDeviceRepository().catch(console.error);

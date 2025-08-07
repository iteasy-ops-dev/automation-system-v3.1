const express = require('express');
const prismaService = require('../services/prisma.service');
const mongoService = require('../services/mongo.service');
const redisService = require('../services/redis.service');
const kafkaService = require('../services/kafka.service');
const n8nEngine = require('../services/n8n-engine.service');
const executionManager = require('../services/execution-manager.service');
const { llmClient, mcpClient, deviceClient } = require('../services/external.service');
const config = require('../config');

const router = express.Router();

// 전체 헬스체크
router.get('/', async (req, res) => {
  try {
    const checks = await Promise.allSettled([
      prismaService.healthCheck(),
      mongoService.healthCheck(),
      redisService.healthCheck(),
      kafkaService.healthCheck(),
      n8nEngine.healthCheck(),
      executionManager.healthCheck(),
      llmClient.healthCheck(),
      mcpClient.healthCheck(),
      deviceClient.healthCheck()
    ]);

    const healthStatus = {
      service: 'workflow-engine',
      version: '1.0.0',
      architecture: 'v3.1',
      status: 'healthy',
      port: config.PORT,
      timestamp: new Date().toISOString(),
      dependencies: {
        prisma: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'unhealthy', error: checks[0].reason?.message },
        mongodb: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'unhealthy', error: checks[1].reason?.message },
        redis: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'unhealthy', error: checks[2].reason?.message },
        kafka: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'unhealthy', error: checks[3].reason?.message },
        n8nEngine: checks[4].status === 'fulfilled' ? checks[4].value : { status: 'unhealthy', error: checks[4].reason?.message },
        executionManager: checks[5].status === 'fulfilled' ? checks[5].value : { status: 'unhealthy', error: checks[5].reason?.message },
        llmService: checks[6].status === 'fulfilled' ? checks[6].value : { status: 'unhealthy', error: checks[6].reason?.message },
        mcpService: checks[7].status === 'fulfilled' ? checks[7].value : { status: 'unhealthy', error: checks[7].reason?.message },
        deviceService: checks[8].status === 'fulfilled' ? checks[8].value : { status: 'unhealthy', error: checks[8].reason?.message }
      }
    };

    // 전체 상태 결정
    const unhealthyServices = Object.values(healthStatus.dependencies)
      .filter(dep => dep.status === 'unhealthy');

    if (unhealthyServices.length > 0) {
      healthStatus.status = 'degraded';
      if (unhealthyServices.length >= 3) {
        healthStatus.status = 'unhealthy';
      }
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    res.status(503).json({
      service: 'workflow-engine',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 개별 서비스 헬스체크
router.get('/prisma', async (req, res) => {
  try {
    const health = await prismaService.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/mongodb', async (req, res) => {
  try {
    const health = await mongoService.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/redis', async (req, res) => {
  try {
    const health = await redisService.healthCheck();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/external-services', async (req, res) => {
  try {
    const [llmHealth, mcpHealth, deviceHealth] = await Promise.allSettled([
      llmClient.healthCheck(),
      mcpClient.healthCheck(),
      deviceClient.healthCheck()
    ]);

    const externalServices = {
      llmService: llmHealth.status === 'fulfilled' ? llmHealth.value : { status: 'unhealthy' },
      mcpService: mcpHealth.status === 'fulfilled' ? mcpHealth.value : { status: 'unhealthy' },
      deviceService: deviceHealth.status === 'fulfilled' ? deviceHealth.value : { status: 'unhealthy' }
    };

    const allHealthy = Object.values(externalServices).every(service => service.status === 'healthy');
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      services: externalServices,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
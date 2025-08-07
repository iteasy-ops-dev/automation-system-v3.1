  private setupRoutes(): void {
    // 헬스체크 라우트 (인증 불필요)
    this.app.get('/health', this.healthController.getHealth.bind(this.healthController));
    this.app.get('/health/ready', this.healthController.getReadiness.bind(this.healthController));
    this.app.get('/health/live', this.healthController.getLiveness.bind(this.healthController));

    // API v1 라우트 (인증 필요)
    const apiRouter = express.Router();
    
    // JWT 인증 미들웨어 적용
    apiRouter.use(authMiddleware());

    // Device 상태 관련 라우트
    apiRouter.get('/devices/:id/status', 
      this.deviceController.getDeviceStatus.bind(this.deviceController)
    );
    
    // Device 메트릭 관련 라우트
    apiRouter.get('/devices/:id/metrics', 
      this.deviceController.getDeviceMetrics.bind(this.deviceController)
    );
    
    // Device 하트비트 라우트
    apiRouter.post('/devices/:id/heartbeat', 
      this.deviceController.sendHeartbeat.bind(this.deviceController)
    );
    
    // Device 전체 건강 상태 라우트
    apiRouter.get('/devices/health', 
      this.deviceController.getDevicesHealth.bind(this.deviceController)
    );
    
    // Device 알림 라우트
    apiRouter.get('/devices/:id/alerts', 
      this.deviceController.getDeviceAlerts.bind(this.deviceController)
    );

    // API 라우터 등록
    this.app.use('/api/v1', apiRouter);

    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    this.logger.info('Routes configured');
  }

  private setupErrorHandling(): void {
    // 전역 에러 핸들러
    this.app.use(errorHandler());
    
    this.logger.info('Error handling configured');
  }

  // 서버 시작
  async start(): Promise<void> {
    try {
      // 데이터베이스 연결 테스트
      await this.prisma.$connect();
      this.logger.info('Database connected');

      // 서버 시작
      const port = config.port;
      this.app.listen(port, () => {
        this.logger.info(`Device Management Service started on port ${port}`, {
          port,
          environment: process.env.NODE_ENV,
          version: config.serviceVersion
        });
      });

      // Graceful shutdown 핸들러
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown`);
      
      try {
        // Prisma 연결 종료
        await this.prisma.$disconnect();
        
        // 캐시 서비스 종료
        await this.cacheService.disconnect();
        
        // 메트릭 서비스 종료
        await this.metricsService.close();
        
        // 이벤트 버스 종료
        await this.eventBusService.disconnect();
        
        // 디바이스 서비스 정리
        await this.deviceService.cleanup();
        
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // 처리되지 않은 예외 처리
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });
  }
}

// 애플리케이션 인스턴스 생성 및 시작
if (require.main === module) {
  const app = new DeviceManagementApp();
  app.start().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

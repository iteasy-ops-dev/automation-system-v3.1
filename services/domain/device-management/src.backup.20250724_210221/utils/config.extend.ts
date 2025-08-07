  private validateConfig(): void {
    const requiredFields = [
      'DATABASE_URL',
      'JWT_SECRET'
    ];

    const missing = requiredFields.filter(field => !process.env[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // 포트 범위 검증
    if (this.config.port < 1024 || this.config.port > 65535) {
      throw new Error(`Invalid port number: ${this.config.port}`);
    }

    // Redis 설정 검증
    if (this.config.redis.port < 1 || this.config.redis.port > 65535) {
      throw new Error(`Invalid Redis port: ${this.config.redis.port}`);
    }

    // JWT Secret 길이 검증
    if (this.config.jwt.secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  public getConfig(): DeviceServiceConfig {
    return { ...this.config }; // 불변성 보장
  }

  public get port(): number {
    return this.config.port;
  }

  public get serviceName(): string {
    return this.config.serviceName;
  }

  public get serviceVersion(): string {
    return this.config.serviceVersion;
  }

  public get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  public get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public get isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}

// 전역 설정 인스턴스
export const config = ConfigManager.getInstance();

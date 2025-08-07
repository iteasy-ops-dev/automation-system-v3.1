#!/usr/bin/env node

/**
 * 시스템 헬스 체크 스크립트
 * 모든 서비스와 데이터스토어의 상태를 확인합니다.
 */

const http = require('http');
const https = require('https');

class HealthChecker {
  constructor() {
    this.services = [
      // Core Services
      { name: 'API Gateway', url: 'http://localhost/health', timeout: 5000 },
      { name: 'Storage Service', url: 'http://localhost:8001/health', timeout: 5000 },
      
      // Domain Services
      { name: 'Device Service', url: 'http://localhost:8101/health', timeout: 5000 },
      { name: 'MCP Service', url: 'http://localhost:8201/health', timeout: 5000 },
      { name: 'LLM Service', url: 'http://localhost:8301/health', timeout: 5000 },
      { name: 'Workflow Engine', url: 'http://localhost:8401/health', timeout: 5000 },
      
      // Frontend Apps
      { name: 'Main App', url: 'http://localhost:3001', timeout: 3000 },
      { name: 'Workflow Editor', url: 'http://localhost:3002', timeout: 3000 },
      { name: 'Admin Portal', url: 'http://localhost:3003', timeout: 3000 },
      
      // Data Stores
      { name: 'PostgreSQL', url: 'http://localhost:5432', timeout: 3000, type: 'tcp' },
      { name: 'MongoDB', url: 'http://localhost:27017', timeout: 3000, type: 'tcp' },
      { name: 'Redis', url: 'http://localhost:6379', timeout: 3000, type: 'tcp' },
      { name: 'InfluxDB', url: 'http://localhost:8086/health', timeout: 3000 },
      { name: 'MinIO', url: 'http://localhost:9000/minio/health/live', timeout: 3000 },
      { name: 'Kafka', url: 'http://localhost:9092', timeout: 3000, type: 'tcp' },
      { name: 'Elasticsearch', url: 'http://localhost:9200/_cluster/health', timeout: 3000 },
      
      // Monitoring
      { name: 'Prometheus', url: 'http://localhost:9090/-/healthy', timeout: 3000 },
      { name: 'Grafana', url: 'http://localhost:3000/api/health', timeout: 3000 },
    ];
    
    this.results = [];
  }

  /**
   * 모든 서비스 헬스 체크 실행
   */
  async checkAll() {
    console.log('🏥 시스템 헬스 체크를 시작합니다...\n');
    
    const startTime = Date.now();
    
    // 병렬로 모든 서비스 체크
    const promises = this.services.map(service => this.checkService(service));
    this.results = await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.printResults(duration);
    
    return this.isAllHealthy();
  }

  /**
   * 개별 서비스 헬스 체크
   */
  async checkService(service) {
    const startTime = Date.now();
    
    try {
      if (service.type === 'tcp') {
        await this.checkTcpConnection(service);
      } else {
        await this.checkHttpHealth(service);
      }
      
      const responseTime = Date.now() - startTime;
      return {
        ...service,
        status: 'healthy',
        responseTime,
        error: null
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        ...service,
        status: 'unhealthy',
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * HTTP 헬스 체크
   */
  checkHttpHealth(service) {
    return new Promise((resolve, reject) => {
      const url = new URL(service.url);
      const client = url.protocol === 'https:' ? https : http;
      
      const request = client.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        timeout: service.timeout
      }, (response) => {
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve();
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Timeout'));
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.end();
    });
  }

  /**
   * TCP 연결 체크
   */
  checkTcpConnection(service) {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const url = new URL(service.url);
      const port = parseInt(url.port);
      
      const socket = new net.Socket();
      
      socket.setTimeout(service.timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Timeout'));
      });
      
      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });
      
      socket.connect(port, url.hostname || 'localhost');
    });
  }

  /**
   * 결과 출력
   */
  printResults(duration) {
    console.log('📊 헬스 체크 결과:\n');
    
    // 카테고리별 분류
    const categories = {
      'Core Services': ['API Gateway', 'Storage Service'],
      'Domain Services': ['Device Service', 'MCP Service', 'LLM Service', 'Workflow Engine'],
      'Frontend Apps': ['Main App', 'Workflow Editor', 'Admin Portal'],
      'Data Stores': ['PostgreSQL', 'MongoDB', 'Redis', 'InfluxDB', 'MinIO', 'Kafka', 'Elasticsearch'],
      'Monitoring': ['Prometheus', 'Grafana']
    };

    for (const [category, serviceNames] of Object.entries(categories)) {
      console.log(`🏷️  ${category}:`);
      
      const categoryServices = this.results.filter(result => 
        serviceNames.includes(result.name)
      );
      
      for (const result of categoryServices) {
        const status = result.status === 'healthy' ? '✅' : '❌';
        const responseTime = `${result.responseTime}ms`;
        const error = result.error ? ` (${result.error})` : '';
        
        console.log(`  ${status} ${result.name.padEnd(20)} ${responseTime.padStart(8)}${error}`);
      }
      
      console.log();
    }

    // 요약 통계
    const healthy = this.results.filter(r => r.status === 'healthy').length;
    const total = this.results.length;
    const unhealthy = total - healthy;
    const avgResponseTime = Math.round(
      this.results.reduce((sum, r) => sum + r.responseTime, 0) / total
    );

    console.log('📈 요약 통계:');
    console.log(`  총 서비스: ${total}개`);
    console.log(`  정상: ${healthy}개 (${Math.round(healthy/total*100)}%)`);
    console.log(`  비정상: ${unhealthy}개`);
    console.log(`  평균 응답 시간: ${avgResponseTime}ms`);
    console.log(`  총 검사 시간: ${duration}ms\n`);

    // 비정상 서비스 상세 정보
    const unhealthyServices = this.results.filter(r => r.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      console.log('🚨 비정상 서비스 상세:');
      for (const service of unhealthyServices) {
        console.log(`  ❌ ${service.name}:`);
        console.log(`     URL: ${service.url}`);
        console.log(`     Error: ${service.error}`);
        console.log(`     Response Time: ${service.responseTime}ms\n`);
      }
    }

    // 전체 상태 판정
    if (this.isAllHealthy()) {
      console.log('🎉 모든 서비스가 정상 상태입니다!');
    } else {
      console.log('⚠️  일부 서비스에 문제가 있습니다.');
      console.log('\n💡 문제 해결 방법:');
      console.log('  1. Docker 컨테이너 상태 확인: docker-compose ps');
      console.log('  2. 로그 확인: npm run dev:logs');
      console.log('  3. 서비스 재시작: npm run dev:stop && npm run dev');
    }
  }

  /**
   * 모든 서비스가 정상인지 확인
   */
  isAllHealthy() {
    return this.results.every(result => result.status === 'healthy');
  }

  /**
   * 핵심 서비스만 체크
   */
  async checkCoreServices() {
    const coreServiceNames = [
      'API Gateway', 'Storage Service', 'PostgreSQL', 'MongoDB', 'Redis'
    ];
    
    console.log('🔧 핵심 서비스 헬스 체크...\n');
    
    const coreServices = this.services.filter(service => 
      coreServiceNames.includes(service.name)
    );
    
    const promises = coreServices.map(service => this.checkService(service));
    const results = await Promise.all(promises);
    
    const healthy = results.filter(r => r.status === 'healthy').length;
    const total = results.length;
    
    console.log(`핵심 서비스 상태: ${healthy}/${total} 정상`);
    
    return healthy === total;
  }
}

// CLI 인터페이스
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  const checker = new HealthChecker();
  
  try {
    let success = false;
    
    switch (command) {
      case 'core':
        success = await checker.checkCoreServices();
        break;
      case 'all':
      default:
        success = await checker.checkAll();
        break;
    }
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 헬스 체크 중 오류 발생:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = HealthChecker;

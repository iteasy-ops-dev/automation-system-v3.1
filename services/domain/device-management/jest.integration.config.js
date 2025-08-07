/**
 * Jest 통합 테스트 설정
 * TASK-7: Device Management Service
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'Integration Tests',
  testMatch: ['**/tests/integration.test.ts'],
  testTimeout: 60000, // 60초 (통합 테스트는 시간이 더 걸림)
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  // 직렬 실행 (병렬 실행 시 데이터베이스 충돌 방지)
  maxWorkers: 1,
  
  // 테스트 전후 훅
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  
  // 환경 변수
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  
  // 모듈 경로 매핑
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // 테스트 파일 감지 제외
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  
  // 로그 레벨 설정
  verbose: true,
  silent: false,
  
  // 에러 처리
  errorOnDeprecated: true,
  
  // 캐시 비활성화 (통합 테스트에서는 캐시로 인한 문제 방지)
  cache: false,
  
  // 테스트 결과 보고
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/integration',
      filename: 'report.html',
      expand: true,
    }],
  ],
};

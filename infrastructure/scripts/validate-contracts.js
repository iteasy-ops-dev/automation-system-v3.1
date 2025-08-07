#!/usr/bin/env node

/**
 * 계약 검증 스크립트
 * 모든 API 계약과 이벤트 스키마의 유효성을 검증합니다.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONTRACTS_DIR = path.join(__dirname, '../../shared/contracts/v1.0');
const REST_DIR = path.join(CONTRACTS_DIR, 'rest');
const EVENTS_DIR = path.join(CONTRACTS_DIR, 'events');

class ContractValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validated = 0;
  }

  /**
   * 모든 계약 파일 검증
   */
  async validateAll() {
    console.log('🔍 계약 검증을 시작합니다...\n');

    // REST API 계약 검증
    await this.validateRestContracts();
    
    // Event 스키마 검증
    await this.validateEventSchemas();
    
    // 결과 출력
    this.printResults();
    
    return this.errors.length === 0;
  }

  /**
   * REST API 계약 검증
   */
  async validateRestContracts() {
    const coreDir = path.join(REST_DIR, 'core');
    const domainDir = path.join(REST_DIR, 'domain');

    if (fs.existsSync(coreDir)) {
      await this.validateDirectory(coreDir, 'Core Services');
    }

    if (fs.existsSync(domainDir)) {
      await this.validateDirectory(domainDir, 'Domain Services');
    }
  }

  /**
   * Event 스키마 검증
   */
  async validateEventSchemas() {
    if (fs.existsSync(EVENTS_DIR)) {
      await this.validateDirectory(EVENTS_DIR, 'Event Schemas', 'json');
    }
  }

  /**
   * 디렉토리 내 파일 검증
   */
  async validateDirectory(dir, category, extension = 'yaml') {
    console.log(`📁 ${category} 검증 중...`);
    
    try {
      const files = fs.readdirSync(dir);
      const contractFiles = files.filter(file => file.endsWith(`.${extension}`) || file.endsWith('.yml'));
      
      if (contractFiles.length === 0) {
        this.warnings.push(`${category}: 계약 파일이 없습니다.`);
        return;
      }

      for (const file of contractFiles) {
        await this.validateFile(path.join(dir, file), extension);
      }
    } catch (error) {
      this.errors.push(`${category}: 디렉토리 읽기 실패 - ${error.message}`);
    }
  }

  /**
   * 개별 파일 검증
   */
  async validateFile(filePath, extension) {
    const fileName = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (extension === 'json') {
        // JSON 스키마 검증
        const schema = JSON.parse(content);
        this.validateJsonSchema(schema, fileName);
      } else {
        // YAML/OpenAPI 검증
        const spec = yaml.load(content);
        this.validateOpenApiSpec(spec, fileName);
      }
      
      this.validated++;
      console.log(`  ✅ ${fileName}`);
      
    } catch (error) {
      this.errors.push(`${fileName}: 파싱 실패 - ${error.message}`);
      console.log(`  ❌ ${fileName}`);
    }
  }

  /**
   * OpenAPI 스펙 검증
   */
  validateOpenApiSpec(spec, fileName) {
    // 필수 필드 검증
    const requiredFields = ['openapi', 'info', 'paths'];
    
    for (const field of requiredFields) {
      if (!spec[field]) {
        this.errors.push(`${fileName}: 필수 필드 '${field}' 누락`);
      }
    }

    // 버전 검증
    if (spec.openapi && !spec.openapi.startsWith('3.0')) {
      this.warnings.push(`${fileName}: OpenAPI 3.0 버전 권장`);
    }

    // 보안 스킴 검증
    if (spec.components && spec.components.securitySchemes) {
      const schemes = spec.components.securitySchemes;
      if (!schemes.bearerAuth) {
        this.warnings.push(`${fileName}: JWT bearerAuth 스킴 권장`);
      }
    }

    // 에러 응답 검증
    if (spec.paths) {
      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (typeof operation === 'object' && operation.responses) {
            if (!operation.responses['400'] && !operation.responses['401'] && !operation.responses['500']) {
              this.warnings.push(`${fileName}: ${method.toUpperCase()} ${path} - 에러 응답 정의 권장`);
            }
          }
        }
      }
    }
  }

  /**
   * JSON 스키마 검증
   */
  validateJsonSchema(schema, fileName) {
    // 필수 필드 검증
    const requiredFields = ['$schema', 'title', 'type'];
    
    for (const field of requiredFields) {
      if (!schema[field]) {
        this.errors.push(`${fileName}: 필수 필드 '${field}' 누락`);
      }
    }

    // 스키마 버전 검증
    if (schema.$schema && !schema.$schema.includes('draft-07')) {
      this.warnings.push(`${fileName}: JSON Schema Draft 7 권장`);
    }

    // 이벤트 필수 필드 검증 (이벤트 스키마인 경우)
    if (schema.properties) {
      const eventRequiredFields = ['eventId', 'eventType', 'timestamp'];
      
      for (const field of eventRequiredFields) {
        if (!schema.properties[field]) {
          this.warnings.push(`${fileName}: 이벤트 필수 필드 '${field}' 권장`);
        }
      }
    }
  }

  /**
   * 검증 결과 출력
   */
  printResults() {
    console.log('\n📊 검증 결과:');
    console.log(`  ✅ 검증된 파일: ${this.validated}개`);
    console.log(`  ⚠️  경고: ${this.warnings.length}개`);
    console.log(`  ❌ 오류: ${this.errors.length}개\n`);

    if (this.warnings.length > 0) {
      console.log('⚠️  경고 사항:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
      console.log();
    }

    if (this.errors.length > 0) {
      console.log('❌ 오류 사항:');
      this.errors.forEach(error => console.log(`  - ${error}`));
      console.log();
    }

    if (this.errors.length === 0) {
      console.log('🎉 모든 계약이 유효합니다!');
    } else {
      console.log('💥 계약 검증에 실패했습니다. 오류를 수정해주세요.');
      process.exit(1);
    }
  }
}

// 메인 실행
async function main() {
  try {
    // 의존성 검사
    try {
      require('js-yaml');
    } catch (error) {
      console.error('❌ js-yaml 모듈이 필요합니다: npm install js-yaml');
      process.exit(1);
    }

    const validator = new ContractValidator();
    const success = await validator.validateAll();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 검증 중 예상치 못한 오류:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ContractValidator;

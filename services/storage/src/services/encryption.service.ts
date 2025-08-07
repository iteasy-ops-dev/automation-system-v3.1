import crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;  // 128 bits
  private readonly tagLength = 16; // 128 bits
  
  private readonly encryptionKey: Buffer;

  constructor() {
    // 환경 변수에서 암호화 키 가져오기
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    this.encryptionKey = Buffer.from(keyHex, 'hex');
    
    if (this.encryptionKey.length !== this.keyLength) {
      throw new Error(`Encryption key must be ${this.keyLength} bytes (${this.keyLength * 2} hex characters)`);
    }
  }

  /**
   * 문자열을 암호화합니다
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    try {
      // IV 생성
      const iv = crypto.randomBytes(this.ivLength);
      
      // 암호화
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      cipher.setAAD(Buffer.from('automation-system', 'utf8'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 인증 태그 가져오기
      const tag = cipher.getAuthTag();
      
      // IV + Tag + Encrypted 데이터 결합
      const result = iv.toString('hex') + tag.toString('hex') + encrypted;
      
      return result;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * 암호화된 문자열을 복호화합니다
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return '';
    }

    try {
      // IV, Tag, 암호화된 데이터 분리
      const ivHex = encryptedData.slice(0, this.ivLength * 2);
      const tagHex = encryptedData.slice(this.ivLength * 2, (this.ivLength + this.tagLength) * 2);
      const encrypted = encryptedData.slice((this.ivLength + this.tagLength) * 2);
      
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      
      // 복호화
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAAD(Buffer.from('automation-system', 'utf8'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * ConnectionInfo 객체의 민감한 필드를 암호화합니다
   */
  encryptConnectionInfo(connectionInfo: any): any {
    if (!connectionInfo) {
      return null;
    }

    const encrypted = { ...connectionInfo };
    
    // 민감한 필드들 암호화
    const sensitiveFields = ['password', 'privateKey', 'sudoPassword'];
    
    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * ConnectionInfo 객체의 민감한 필드를 복호화합니다
   */
  decryptConnectionInfo(connectionInfo: any): any {
    if (!connectionInfo) {
      return null;
    }

    const decrypted = { ...connectionInfo };
    
    // 민감한 필드들 복호화
    const sensitiveFields = ['password', 'privateKey', 'sudoPassword'];
    
    for (const field of sensitiveFields) {
      if (decrypted[field]) {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          // 복호화 실패 시 필드 제거 (보안상 안전)
          delete decrypted[field];
        }
      }
    }
    
    return decrypted;
  }

  /**
   * 조회 시 민감한 정보를 마스킹합니다
   */
  maskSensitiveInfo(connectionInfo: any): any {
    if (!connectionInfo) {
      return null;
    }

    const masked = { ...connectionInfo };
    
    // 민감한 필드들 마스킹
    if (masked.password) {
      masked.password = '***';
    }
    if (masked.privateKey) {
      masked.privateKey = '*** (SSH Key Present) ***';
    }
    if (masked.sudoPassword) {
      masked.sudoPassword = '***';
    }
    
    return masked;
  }

  /**
   * 암호화 키 생성 유틸리티 (설정 시 사용)
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// 싱글톤 인스턴스
export const encryptionService = new EncryptionService();

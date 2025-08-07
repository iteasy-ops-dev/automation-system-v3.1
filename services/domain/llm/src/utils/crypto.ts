/**
 * Crypto Utility - API 키 암호화/복호화
 */

import crypto from 'crypto';
import logger from './logger';

// 암호화 키 - 환경변수에서 가져오거나 기본값 사용
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * 문자열 암호화
 */
export function encrypt(text: string): string {
  try {
    // 랜덤 IV 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 랜덤 Salt 생성
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // 키 파생
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
    
    // 암호화
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    
    // 인증 태그 가져오기
    const tag = cipher.getAuthTag();
    
    // Salt + IV + Tag + 암호화된 데이터 합치기
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 문자열 복호화
 */
export function decrypt(encryptedText: string): string {
  try {
    // Base64 디코딩
    const buffer = Buffer.from(encryptedText, 'base64');
    
    // 구성 요소 분리
    const salt = buffer.slice(0, SALT_LENGTH);
    const iv = buffer.slice(SALT_LENGTH, TAG_POSITION);
    const tag = buffer.slice(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = buffer.slice(ENCRYPTED_POSITION);
    
    // 키 파생
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
    
    // 복호화
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * 암호화 키 유효성 검증
 */
export function validateEncryptionKey(): boolean {
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('Using default encryption key. Set ENCRYPTION_KEY environment variable for production.');
    return false;
  }
  
  if (process.env.ENCRYPTION_KEY.length < 32) {
    logger.error('Encryption key is too short. Must be at least 32 characters.');
    return false;
  }
  
  return true;
}

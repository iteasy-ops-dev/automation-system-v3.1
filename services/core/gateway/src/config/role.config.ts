/**
 * Role 매핑 설정
 * 환경 변수를 통해 role 변환 동작을 제어
 * 
 * @author Backend Team
 * @since 2025-07-31
 */

export interface RoleConfig {
  /**
   * Role 매핑 활성화 여부
   * true: 레거시 role을 계약 role로 자동 변환
   * false: 변환 없이 원본 값 유지 (기본값)
   */
  enableRoleMapping: boolean;

  /**
   * Role 매핑 모드
   * 'strict': 계약에 정의된 role만 허용
   * 'compatible': 레거시와 계약 role 모두 허용 (기본값)
   * 'legacy': 레거시 role만 사용
   */
  mappingMode: 'strict' | 'compatible' | 'legacy';

  /**
   * 로깅 활성화
   * Role 변환 시 로그 출력 여부
   */
  enableLogging: boolean;
}

/**
 * 환경 변수에서 Role 설정 로드
 */
export function loadRoleConfig(): RoleConfig {
  return {
    enableRoleMapping: process.env.ROLE_MAPPING_ENABLED === 'true',
    mappingMode: (process.env.ROLE_MAPPING_MODE as RoleConfig['mappingMode']) || 'compatible',
    enableLogging: process.env.ROLE_MAPPING_LOG === 'true',
  };
}

/**
 * 현재 Role 설정 가져오기 (싱글톤)
 */
let cachedConfig: RoleConfig | null = null;

export function getRoleConfig(): RoleConfig {
  if (!cachedConfig) {
    cachedConfig = loadRoleConfig();
  }
  return cachedConfig;
}

/**
 * Role 설정 리로드 (테스트용)
 */
export function reloadRoleConfig(): void {
  cachedConfig = null;
}
/**
 * Role 매핑 유틸리티
 * 레거시 role 값과 계약 기반 role 값 간의 변환을 담당
 * 
 * @author Backend Team
 * @since 2025-07-31
 */

import { LegacyRole, ContractRole, Role } from '../types/gateway.types';

/**
 * Role 매핑 설정
 */
export const ROLE_MAPPINGS = {
  // 레거시 → 계약
  toContract: {
    'admin': 'administrator' as ContractRole,
    'user': 'viewer' as ContractRole,
  },
  // 계약 → 레거시
  toLegacy: {
    'administrator': 'admin' as LegacyRole,
    'operator': 'admin' as LegacyRole, // operator는 현재 admin으로 매핑
    'viewer': 'user' as LegacyRole,
  }
} as const;

/**
 * 레거시 role을 계약 role로 변환
 * @param legacyRole 레거시 role 값 ('admin', 'user')
 * @returns 계약 role 값 ('administrator', 'operator', 'viewer')
 */
export function mapToContractRole(legacyRole: string): ContractRole {
  return ROLE_MAPPINGS.toContract[legacyRole as LegacyRole] || legacyRole as ContractRole;
}

/**
 * 계약 role을 레거시 role로 변환
 * @param contractRole 계약 role 값 ('administrator', 'operator', 'viewer')
 * @returns 레거시 role 값 ('admin', 'user')
 */
export function mapToLegacyRole(contractRole: string): LegacyRole {
  return ROLE_MAPPINGS.toLegacy[contractRole as ContractRole] || contractRole as LegacyRole;
}

/**
 * Role이 레거시 값인지 확인
 * @param role 확인할 role 값
 * @returns 레거시 role 여부
 */
export function isLegacyRole(role: string): role is LegacyRole {
  return role === 'admin' || role === 'user';
}

/**
 * Role이 계약 값인지 확인
 * @param role 확인할 role 값
 * @returns 계약 role 여부
 */
export function isContractRole(role: string): role is ContractRole {
  return role === 'administrator' || role === 'operator' || role === 'viewer';
}

/**
 * Role 정규화 (환경 설정에 따라 변환 여부 결정)
 * @param role 원본 role 값
 * @param toContract true면 계약 role로, false면 현재 값 유지
 * @returns 정규화된 role 값
 */
export function normalizeRole(role: string, toContract: boolean = false): Role {
  if (!toContract) {
    return role as Role;
  }
  
  if (isLegacyRole(role)) {
    return mapToContractRole(role);
  }
  
  return role as Role;
}

/**
 * 권한 레벨 확인 (상위 권한이 하위 권한을 포함)
 * @param userRole 사용자의 role
 * @param requiredRole 필요한 최소 role
 * @returns 권한 충족 여부
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  // Role 계층 구조 정의
  const roleHierarchy: Record<Role, number> = {
    'administrator': 3,
    'admin': 3,  // admin = administrator
    'operator': 2,
    'viewer': 1,
    'user': 1,   // user = viewer
  };
  
  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * 여러 role 중 하나라도 가지고 있는지 확인
 * @param userRole 사용자의 role
 * @param allowedRoles 허용된 role 배열
 * @returns 권한 보유 여부
 */
export function hasAnyRole(userRole: Role, allowedRoles: Role[]): boolean {
  // 직접 매칭
  if (allowedRoles.includes(userRole)) {
    return true;
  }
  
  // 레거시-계약 간 매핑 확인
  if (isLegacyRole(userRole)) {
    const contractRole = mapToContractRole(userRole);
    return allowedRoles.includes(contractRole);
  }
  
  if (isContractRole(userRole)) {
    const legacyRole = mapToLegacyRole(userRole);
    return allowedRoles.includes(legacyRole);
  }
  
  return false;
}

/**
 * Role 표시명 가져오기 (UI용)
 * @param role Role 값
 * @returns 사용자 친화적인 표시명
 */
export function getRoleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    'administrator': '관리자',
    'admin': '관리자',
    'operator': '운영자',
    'viewer': '조회자',
    'user': '사용자',
  };
  
  return displayNames[role] || role;
}

/**
 * Role 설명 가져오기
 * @param role Role 값
 * @returns Role에 대한 설명
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    'administrator': '시스템의 모든 기능에 대한 전체 권한',
    'admin': '시스템의 모든 기능에 대한 전체 권한',
    'operator': '시스템 운영 및 모니터링 권한',
    'viewer': '읽기 전용 권한',
    'user': '읽기 전용 권한',
  };
  
  return descriptions[role] || '권한 정보 없음';
}
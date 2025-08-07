/**
 * 날짜/시간 유틸리티 함수
 */

import { format, formatDistance, parseISO, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * ISO 문자열을 포맷된 날짜로 변환
 */
export function formatDate(
  dateString: string,
  formatString: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) {
      return 'Invalid Date';
    }
    return format(date, formatString, { locale: ko });
  } catch {
    return 'Invalid Date';
  }
}

/**
 * 타임스탬프 포맷 (채팅용)
 */
export function formatTimestamp(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      return 'Invalid Date';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    // 1분 미만: "방금 전"
    if (diffMinutes < 1) return '방금 전';
    
    // 1시간 미만: "N분 전"
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    
    // 24시간 미만: "HH:MM"
    if (diffMinutes < 1440) {
      return format(dateObj, 'HH:mm');
    }
    
    // 그 이상: "MM/dd HH:MM"
    return format(dateObj, 'MM/dd HH:mm');
  } catch {
    return 'Invalid Date';
  }
}

/**
 * 상대적 시간 표시 (예: "2분 전")
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) {
      return 'Invalid Date';
    }
    return formatDistance(date, new Date(), { 
      addSuffix: true,
      locale: ko 
    });
  } catch {
    return 'Invalid Date';
  }
}

/**
 * 현재 시간을 ISO 문자열로 반환
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

/**
 * 밀리초를 읽기 쉬운 시간으로 변환
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
  return `${seconds}초`;
}

/**
 * 시간대 변환
 */
export function convertTimezone(
  dateString: string,
  timezone: string = 'Asia/Seoul'
): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) {
      return 'Invalid Date';
    }
    
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return 'Invalid Date';
  }
}
/**
 * 한국 공휴일 계산 유틸리티
 * - 고정 공휴일 (양력)
 * - 음력 공휴일 (설날, 부처님오신날, 추석) - 미리 계산된 룩업 테이블
 * - 대체공휴일 처리
 */

// 고정 공휴일 (month, day)
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],   // 신정
  [3, 1],   // 삼일절
  [5, 5],   // 어린이날
  [6, 6],   // 현충일
  [8, 15],  // 광복절
  [10, 3],  // 개천절
  [10, 9],  // 한글날
  [12, 25], // 성탄절
];

// 음력 공휴일 양력 변환 룩업 테이블 (2024~2030)
// 형식: { year: { holidayName: [month, day][] } }
// 설날: 음력 1/1 ± 1일 (3일간)
// 부처님오신날: 음력 4/8
// 추석: 음력 8/15 ± 1일 (3일간)
const LUNAR_HOLIDAYS: Record<number, { seollal: [number, number][]; buddha: [number, number]; chuseok: [number, number][] }> = {
  2024: {
    seollal: [[2, 9], [2, 10], [2, 11]],      // 설날 연휴
    buddha: [5, 15],                            // 부처님오신날
    chuseok: [[9, 16], [9, 17], [9, 18]],      // 추석 연휴
  },
  2025: {
    seollal: [[1, 28], [1, 29], [1, 30]],
    buddha: [5, 5],
    chuseok: [[10, 5], [10, 6], [10, 7]],
  },
  2026: {
    seollal: [[2, 16], [2, 17], [2, 18]],
    buddha: [5, 24],
    chuseok: [[9, 24], [9, 25], [9, 26]],
  },
  2027: {
    seollal: [[2, 5], [2, 6], [2, 7]],
    buddha: [5, 13],
    chuseok: [[9, 14], [9, 15], [9, 16]],
  },
  2028: {
    seollal: [[1, 25], [1, 26], [1, 27]],
    buddha: [5, 2],
    chuseok: [[10, 2], [10, 3], [10, 4]],
  },
  2029: {
    seollal: [[2, 12], [2, 13], [2, 14]],
    buddha: [5, 20],
    chuseok: [[9, 21], [9, 22], [9, 23]],
  },
  2030: {
    seollal: [[2, 2], [2, 3], [2, 4]],
    buddha: [5, 9],
    chuseok: [[9, 11], [9, 12], [9, 13]],
  },
};

/**
 * 대체공휴일 계산: 공휴일이 일요일이면 다음 월요일 추가
 * 설날/추석의 경우 연휴 중 일요일이 끼면 연휴 다음 날 대체공휴일
 */
function getSubstituteHolidays(year: number, holidays: Set<string>): [number, number][] {
  const substitutes: [number, number][] = [];

  // 고정 공휴일 대체: 일요일이면 다음 월요일
  for (const [m, d] of FIXED_HOLIDAYS) {
    const date = new Date(year, m - 1, d);
    if (date.getDay() === 0) { // 일요일
      // 다음 월요일 찾기 (공휴일과 겹치지 않는)
      let subDate = new Date(year, m - 1, d + 1);
      const subKey = `${subDate.getMonth() + 1}-${subDate.getDate()}`;
      if (!holidays.has(subKey)) {
        substitutes.push([subDate.getMonth() + 1, subDate.getDate()]);
      } else {
        subDate = new Date(year, m - 1, d + 2);
        substitutes.push([subDate.getMonth() + 1, subDate.getDate()]);
      }
    }
  }

  // 설날/추석 대체공휴일: 연휴 중 일요일이 끼면 연휴 다음날 대체
  const lunar = LUNAR_HOLIDAYS[year];
  if (lunar) {
    for (const cluster of [lunar.seollal, lunar.chuseok]) {
      let hasSunday = false;
      let maxDay = 0;
      let maxMonth = 0;
      for (const [m, d] of cluster) {
        const date = new Date(year, m - 1, d);
        if (date.getDay() === 0) hasSunday = true;
        if (m > maxMonth || (m === maxMonth && d > maxDay)) {
          maxMonth = m;
          maxDay = d;
        }
      }
      if (hasSunday) {
        let subDate = new Date(year, maxMonth - 1, maxDay + 1);
        let key = `${subDate.getMonth() + 1}-${subDate.getDate()}`;
        while (holidays.has(key)) {
          subDate = new Date(subDate.getTime() + 86400000);
          key = `${subDate.getMonth() + 1}-${subDate.getDate()}`;
        }
        substitutes.push([subDate.getMonth() + 1, subDate.getDate()]);
      }
    }

    // 어린이날(5/5) + 부처님오신날 겹침 대체
    const [buddhaM, buddhaD] = lunar.buddha;
    const buddhaDate = new Date(year, buddhaM - 1, buddhaD);
    if (buddhaDate.getDay() === 0) {
      const sub = new Date(year, buddhaM - 1, buddhaD + 1);
      const key = `${sub.getMonth() + 1}-${sub.getDate()}`;
      if (!holidays.has(key)) {
        substitutes.push([sub.getMonth() + 1, sub.getDate()]);
      }
    }
  }

  return substitutes;
}

/**
 * 특정 연/월의 공휴일 날짜(일) 목록을 반환
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 공휴일인 날짜 배열 (예: [1, 15, 25])
 */
export function getKoreanHolidays(year: number, month: number): number[] {
  const allHolidays = new Set<string>(); // "month-day" format

  // 1. 고정 공휴일 추가
  for (const [m, d] of FIXED_HOLIDAYS) {
    allHolidays.add(`${m}-${d}`);
  }

  // 2. 음력 공휴일 추가
  const lunar = LUNAR_HOLIDAYS[year];
  if (lunar) {
    for (const [m, d] of lunar.seollal) {
      allHolidays.add(`${m}-${d}`);
    }
    allHolidays.add(`${lunar.buddha[0]}-${lunar.buddha[1]}`);
    for (const [m, d] of lunar.chuseok) {
      allHolidays.add(`${m}-${d}`);
    }
  }

  // 3. 대체공휴일 추가
  const substitutes = getSubstituteHolidays(year, allHolidays);
  for (const [m, d] of substitutes) {
    allHolidays.add(`${m}-${d}`);
  }

  // 4. 해당 월의 공휴일만 필터
  const result: number[] = [];
  for (const key of allHolidays) {
    const [m, d] = key.split("-").map(Number);
    if (m === month) {
      result.push(d);
    }
  }

  return result.sort((a, b) => a - b);
}

/**
 * 특정 날짜가 공휴일인지 확인
 */
export function isKoreanHoliday(year: number, month: number, day: number): boolean {
  const holidays = getKoreanHolidays(year, month);
  return holidays.includes(day);
}

/**
 * 특정 날짜가 주말(토/일)인지 확인
 */
export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

/**
 * 특정 날짜가 휴일(주말 또는 공휴일)인지 확인
 */
export function isHoliday(year: number, month: number, day: number): boolean {
  return isWeekend(year, month, day) || isKoreanHoliday(year, month, day);
}

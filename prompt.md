# 프로젝트 실행 지침서

## 프로젝트 개요
병동 간호사 근무표 관리 시스템 (Nurse Schedule Manager)
- PRD: docs/PRD-20260216-095455.md
- WBS: docs/WBS-20260216-094853.md

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 15.5.x |
| Language | TypeScript | 5.9.x |
| UI | React | 19.2.x |
| ORM | Prisma | 6.19.x |
| Database | SQLite (dev) / PostgreSQL (prod) | - |
| State | Zustand | 5.0.x |
| Styling | Tailwind CSS (CSS-based config) | 4.2.x |
| Auth | bcryptjs + jose (JWT) | 3.x / 6.x |
| Validation | Zod | 4.3.x |
| Date | date-fns | 4.1.x |
| Print | react-to-print | 3.2.x |
| Excel | SheetJS (xlsx) | 0.18.x |
| Icons | Lucide React | 0.575.x |
| Theme | next-themes | 0.4.x |
| Table | @tanstack/react-table | 8.21.x |
| Linting | ESLint (flat config) | 9.39.x |

## 프로젝트 설정 참고사항

### Next.js 15 + React 19
- App Router 사용 (pages/ 아님)
- API route params는 비동기: `{ params: Promise<{ id: string }> }`
- forwardRef 불필요 (React 19)
- `src/app/not-found.tsx` 필수

### Tailwind CSS 4
- CSS 기반 설정: `src/app/globals.css`에서 `@theme`, `@custom-variant`, `@utility` 사용
- `tailwind.config.ts` 파일 없음 (삭제됨)
- 클래스 변경: `shadow-sm` → `shadow-xs`, `outline-none` → `outline-hidden`

### ESLint 9
- Flat config: `eslint.config.mjs` 사용
- `.eslintrc.json` 파일 없음 (삭제됨)
- FlatCompat 브릿지로 next/core-web-vitals 호환

### Prisma 6
- SQLite provider (로컬 개발)
- `prisma/schema.prisma`에서 provider 변경으로 PostgreSQL 전환 가능
- 11개 모델: Ward, Nurse, User, ShiftType, Schedule, ScheduleEntry, ScheduleSummary, ScheduleApproval, ScheduleChangeLog, SchedulePrintLog, NursePreference

## 근무 유형 정의

| 코드 | 의미 | 설명 |
|------|------|------|
| D | Day (주간) | 근무일 |
| E | Evening (저녁) | 근무일 |
| N | Night (야간) | 근무일 |
| T | Training (교육) | - |
| O | Off (공휴) | 비근무일 |
| X | 휴무 | 비근무일 |
| B | 기타 | - |

## 직위 코드

| 코드 | 의미 | positionRank |
|------|------|-------------|
| HN | 수간호사 (Head Nurse) | 1 |
| CN | 책임간호사 (Charge Nurse) | 2 |
| AN | 주임간호사 (Senior Nurse) | 3 |
| RN | 일반간호사 (General Nurse) | 4 |

## 사용자 역할

| 역할 | 권한 |
|------|------|
| HEAD_NURSE | 근무표 작성, 확정/해제, 간호사 관리 |
| NURSING_MANAGER | 1차 승인 권한 |
| NURSING_DIRECTOR | 최종 승인 권한 |
| ADMIN | 전체 시스템 관리 |

## 테스트 계정 (비밀번호: 1234)

| 아이디 | 이름 | 역할 |
|--------|------|------|
| headnurse | 진인숙 | HEAD_NURSE |
| chargenurse | 김경선 | HEAD_NURSE |
| manager | 이정숙 | NURSING_MANAGER |
| director | 박영희 | NURSING_DIRECTOR |
| admin | 시스템관리자 | ADMIN |

## 주요 명령어

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # prisma generate + db push + next build
npm run lint         # ESLint
npx prisma db push   # 스키마 동기화
npx prisma db seed   # 시드 데이터
npx tsc --noEmit     # 타입 체크
```

## 핵심 아키텍처 패턴

### 인증 흐름
```
POST /api/auth/login → bcrypt 검증 → JWT 생성 (HS256, 7일) → httpOnly 쿠키 설정
↓
미들웨어: 모든 요청 → JWT 검증 → 실패 시 /login 리다이렉트 (API는 401)
↓
AuthContext: /api/auth/me 호출 → user, loading, logout 제공
```

### 데이터 저장 흐름
```
그리드 셀 편집 → Zustand updateCell/updateCells → isDirty=true
↓
저장 버튼 → PUT /api/schedules/[id]/entries → DB 비교 → ChangeLog 생성 → Upsert → Summary 재계산
```

### AI 편성 흐름
```
설정 입력 (최소인원, 제약조건) → POST /api/schedules/[id]/generate
↓
6단계 알고리즘 실행 → Simulated Annealing 최적화
↓
미리보기 결과 반환 → 사용자 확인 → 그리드에 적용
```

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| DATABASE_URL | DB 연결 문자열 | file:./dev.db |
| JWT_SECRET | JWT 서명 키 | fallback-secret-change-me |

## 배포

- **Platform**: Vercel
- **DB 전환**: `prisma/schema.prisma`에서 provider를 `postgresql`로 변경
- **환경변수**: Vercel 대시보드에서 `DATABASE_URL`, `JWT_SECRET` 설정
- **빌드**: `prisma generate && prisma db push && next build`

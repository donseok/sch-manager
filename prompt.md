# Ralph-Loop 실행 지침서

## 프로젝트 개요
병동 간호사 근무표 관리 시스템 (Nurse Schedule Manager)
- PRD: docs/PRD-20260216-095455.md
- TRD: docs/TRD-20260216-095754.md
- WBS: docs/WBS-20260216-094853.md

## 기술 스택 (환경 적응)
TRD 원본 스택에서 환경 제약(Maven/Gradle/Docker 미설치)을 반영하여 조정:

| 영역 | TRD 원본 | 적용 스택 | 사유 |
|------|----------|----------|------|
| Frontend | Next.js 14, TypeScript, Tailwind, Zustand, TanStack Table | **동일** | 환경 호환 |
| Backend | Spring Boot 3.2, Java 17 | **Next.js API Routes** | Maven/Gradle 미설치 |
| ORM | Spring Data JPA, Hibernate Envers | **Prisma ORM** | Node.js 생태계 |
| Database | PostgreSQL 16 | **SQLite (dev) / PostgreSQL (prod)** | Docker 미설치 |
| Auth | Spring Security + JWT | **NextAuth.js + JWT** | Node.js 생태계 |
| Cache | Redis 7.2 | **In-memory (dev)** | Redis 미설치 |

**핵심**: 데이터 모델, 비즈니스 로직, UI 요구사항은 TRD/PRD 100% 준수

## Ralph-Loop 실행 규칙

### 루프 구조
```
PHASE → TASK → IMPLEMENT → VERIFY → NEXT_TASK (or NEXT_PHASE)
```

### 규칙
1. **각 Phase는 순서대로 실행**한다 (Phase 건너뛰기 금지)
2. **각 Task는 구현 후 반드시 검증**한다 (빌드/린트 통과 확인)
3. **검증 실패 시 해당 Task를 수정 후 재검증**한다
4. **Phase 완료 시 통합 검증**을 수행한다
5. **의사결정은 AI가 자율적으로 수행**한다 (사용자 개입 최소화)
6. **PRD의 미해결 사항은 합리적 가정으로 결정**한다

### 미해결 사항 결정 (PRD 섹션 6)
| 항목 | 결정 |
|------|------|
| 근무 유형 정의 | D=Day, E=Evening, N=Night, O=Off, X=휴무, T=Training, B=기타 |
| X+O 집계 | X와 O의 합산 |
| 승인 프로세스 | 수간호사→간호과장→간호부장 3단계 |
| 반려 시 프로세스 | 이전 단계로 반려, 사유 필수 |
| 확정 후 수정 | 가능, 사유 필수, 재승인 불필요(수정이력만 기록) |
| 수정 권한 | 수간호사 이상 |
| 수정 기한 | 해당 월 종료 후 1개월까지 |
| 직위 코드 | HN=수간호사, RN=일반간호사, CN=책임간호사, AN=주임간호사 |

---

## Phase 1: 프로젝트 초기화 (Project Setup)
**목표**: 프로젝트 구조 생성, 의존성 설치, 개발환경 구성

### Task 1.1: Next.js 프로젝트 생성
- `npx create-next-app@14` 으로 프로젝트 초기화
- TypeScript, Tailwind CSS, App Router, ESLint 활성화
- src/ 디렉토리 구조 사용

### Task 1.2: 추가 의존성 설치
- Prisma ORM
- NextAuth.js
- TanStack Table v8
- Zustand
- react-to-print
- date-fns (날짜 유틸)
- bcryptjs (비밀번호 해시)
- zod (유효성 검증)
- lucide-react (아이콘)

### Task 1.3: Prisma 스키마 작성
- TRD 섹션 4의 DB 설계를 Prisma 스키마로 변환
- 테이블: wards, nurses, users, shift_types, schedules, schedule_entries, schedule_summaries, schedule_approvals, schedule_change_logs, schedule_print_logs
- SQLite provider로 개발 환경 구성

### Task 1.4: 시드 데이터 작성
- 기본 근무 유형(D/E/N/O/X/T/B) 생성
- 42병동 데이터 생성
- 테스트용 간호사 20명 데이터 생성
- 관리자 계정 생성 (수간호사/간호과장/간호부장)

### Task 1.5: 프로젝트 디렉토리 구조 생성
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (auth)/            # 인증 관련 페이지
│   ├── dashboard/         # 대시보드
│   ├── schedules/         # 근무표 관리
│   ├── nurses/            # 간호사 관리
│   └── layout.tsx         # 루트 레이아웃
├── components/            # 공통 컴포넌트
│   ├── ui/               # 기본 UI 컴포넌트
│   ├── schedule/         # 근무표 관련 컴포넌트
│   └── layout/           # 레이아웃 컴포넌트
├── lib/                  # 유틸리티 및 설정
│   ├── prisma.ts         # Prisma 클라이언트
│   ├── auth.ts           # NextAuth 설정
│   └── utils.ts          # 유틸리티 함수
├── store/                # Zustand 스토어
└── types/                # TypeScript 타입 정의
```

**Phase 1 검증**: `npm run build` 성공, Prisma 마이그레이션 성공, 시드 데이터 적용 확인

---

## Phase 2: 인력 관리 모듈 (REQ-006)
**목표**: 간호사 사원 정보 CRUD 구현

### Task 2.1: 간호사 관리 API
- GET /api/nurses - 목록 조회 (병동별 필터링)
- POST /api/nurses - 신규 등록
- GET /api/nurses/[id] - 상세 조회
- PUT /api/nurses/[id] - 정보 수정
- DELETE /api/nurses/[id] - 삭제(비활성화)

### Task 2.2: 간호사 관리 UI
- 간호사 목록 페이지 (테이블, 검색, 필터)
- 간호사 등록/수정 폼 (모달)
- 병동별 필터링

### Task 2.3: 병동 관리 API & UI
- 병동 CRUD API
- 병동 관리 간이 UI

**Phase 2 검증**: 간호사 CRUD 동작 확인, 병동별 필터 동작 확인

---

## Phase 3: 근무표 핵심 기능 (REQ-001, REQ-002)
**목표**: 근무표 생성/편집/조회 및 자동 집계

### Task 3.1: 근무표 관리 API
- POST /api/schedules - 월간 근무표 생성
- GET /api/schedules - 근무표 목록 조회
- GET /api/schedules/[id] - 근무표 상세 조회 (entries 포함)
- PUT /api/schedules/[id] - 근무표 수정
- GET /api/schedules/[id]/summary - 집계 조회

### Task 3.2: 근무 배정 API
- PUT /api/schedules/[id]/entries - 일괄 근무 배정 저장
- GET /api/schedules/[id]/entries - 근무 배정 조회

### Task 3.3: 자동 집계 로직
- 간호사별 근무유형 횟수 자동 계산 (D/E/N/T/X/O/X+O)
- 근무표 저장 시 집계 자동 갱신
- schedule_summaries 테이블 동기화

### Task 3.4: 근무표 그리드 UI (핵심)
- TanStack Table 기반 근무표 그리드
- 행: 간호사 목록, 열: 날짜(1~31)
- 셀 클릭으로 근무유형 선택/변경
- 근무유형별 색상 구분
- 우측 집계 컬럼 표시

### Task 3.5: 근무표 생성/조회 페이지
- 병동/연월 선택하여 근무표 생성
- 기존 근무표 목록 조회
- 근무표 상세 편집 페이지

**Phase 3 검증**: 근무표 생성→편집→저장→조회 플로우 동작, 집계 정확성 확인

---

## Phase 4: 승인 워크플로우 (REQ-003)
**목표**: 근무표 확정/승인 프로세스 구현

### Task 4.1: 워크플로우 API
- POST /api/schedules/[id]/submit - 확정 요청 (DRAFT→PENDING_MANAGER)
- POST /api/schedules/[id]/approve - 승인 (PENDING_MANAGER→PENDING_DIRECTOR→CONFIRMED)
- POST /api/schedules/[id]/reject - 반려

### Task 4.2: 승인 이력 관리
- schedule_approvals 테이블 기록
- 단계별 승인자/일시/코멘트 저장

### Task 4.3: 승인 UI
- 근무표 상태 표시 (배지)
- 승인 요청/승인/반려 버튼
- 승인 이력 조회

**Phase 4 검증**: DRAFT→PENDING_MANAGER→PENDING_DIRECTOR→CONFIRMED 전체 플로우 동작

---

## Phase 5: 인증/권한 (AUTH)
**목표**: 로그인 및 역할 기반 접근 제어

### Task 5.1: NextAuth 설정
- Credentials Provider (아이디/비밀번호)
- JWT 세션 전략
- 역할 정보 토큰에 포함

### Task 5.2: 로그인 페이지
- 로그인 폼 UI
- 에러 메시지 표시

### Task 5.3: 권한 기반 접근 제어
- 미들웨어로 인증 확인
- 역할별 메뉴/기능 제한
  - HEAD_NURSE: 근무표 작성, 확정 요청
  - NURSING_MANAGER: 1차 승인
  - NURSING_DIRECTOR: 최종 승인
  - ADMIN: 전체 관리

**Phase 5 검증**: 로그인→역할별 기능 접근 확인

---

## Phase 6: 수정 이력 및 월별 관리 (REQ-004, REQ-005)
**목표**: 변경 이력 추적 및 월별 연속 관리

### Task 6.1: 수정 이력 API
- 근무표 수정 시 변경 전/후 자동 기록
- GET /api/schedules/[id]/history - 수정 이력 조회

### Task 6.2: 수정 이력 UI
- 변경 이력 목록 표시
- 원본/수정본 비교 (변경 셀 하이라이트)

### Task 6.3: 월별 연속 관리
- 이전 월 근무표 참조 기능
- 간호사별 누적 집계 조회

**Phase 6 검증**: 수정 이력 기록/조회 동작, 월별 연속 조회 동작

---

## Phase 7: 출력 기능 (REQ-007)
**목표**: 근무표 인쇄/다운로드

### Task 7.1: 인쇄 기능
- react-to-print 기반 브라우저 인쇄
- 인쇄용 레이아웃 (A4 가로)

### Task 7.2: 출력 이력 관리
- 출력일시/출력자 자동 기록
- schedule_print_logs 테이블 저장

**Phase 7 검증**: 인쇄 미리보기 동작, 출력 이력 기록

---

## Phase 8: UI/UX 완성 및 안정화
**목표**: 대시보드, 네비게이션, 전체 통합 테스트

### Task 8.1: 대시보드
- 금월 근무표 현황 요약
- 승인 대기 목록
- 최근 활동 로그

### Task 8.2: 공통 레이아웃
- 사이드바 네비게이션
- 헤더 (사용자 정보, 로그아웃)
- 반응형 디자인

### Task 8.3: 통합 검증
- 전체 플로우 테스트
- 빌드 성공 확인

**Phase 8 검증**: `npm run build` 성공, 전체 기능 동작 확인

---

## 루프 종료 조건
- 모든 Phase(1~8) 완료
- `npm run build` 성공
- PRD의 REQ-001 ~ REQ-007 모두 구현 완료

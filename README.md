# 병원 간호사 근무표 관리 시스템 (Nurse Schedule Manager)

42병동 간호사 근무 스케줄을 디지털로 편성, 관리, 확정하는 웹 애플리케이션입니다.

## 주요 기능

- **근무표 그리드 편집기** — 인터랙티브 테이블에서 마우스 드래그 선택, Ctrl+C/V 복사/붙여넣기 (Excel 호환)
- **자동 집계** — 간호사별 근무 유형(D/E/N/T/X/O/XO) 횟수 실시간 자동 계산
- **AI 자동 편성** — 6단계 알고리즘 + Simulated Annealing으로 최적화된 근무표 자동 생성
- **확정/승인 워크플로우** — DRAFT → CONFIRMED 상태 관리, 월별 1개 확정본
- **수정 이력 관리** — 모든 셀 변경 이력 자동 기록 및 추적
- **대시보드** — 금일 근무 현황, 주간 미리보기, 공정성 지표, 위반 알림
- **인쇄/Excel 내보내기** — react-to-print 기반 인쇄, SheetJS XLSX 다운로드
- **간호사/병동 관리** — CRUD, 직위별 정렬, 병동별 필터링
- **인증/권한** — JWT + bcrypt 로그인, 역할 기반 접근 제어
- **다크 모드** — next-themes 기반 테마 전환

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 15.5.x |
| Language | TypeScript | 5.9.x |
| UI | React | 19.2.x |
| ORM | Prisma | 6.19.x |
| Database | SQLite (local) / PostgreSQL (prod) | - |
| State | Zustand | 5.0.x |
| Styling | Tailwind CSS | 4.2.x |
| Auth | bcryptjs + jose (JWT) | 3.x / 6.x |
| Linting | ESLint (flat config) | 9.x |

## 시작하기

### 사전 요구사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
# 의존성 설치
npm install

# DB 스키마 동기화 + 시드 데이터 입력
npx prisma db push
npx prisma db seed

# 개발 서버 실행
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 접속합니다.

### 테스트 계정 (비밀번호: `1234`)

| 아이디 | 이름 | 역할 |
|--------|------|------|
| headnurse | 진인숙 | 수간호사 (HEAD_NURSE) |
| chargenurse | 김경선 | 수간호사 (HEAD_NURSE) |
| manager | 이정숙 | 간호과장 (NURSING_MANAGER) |
| director | 박영희 | 간호부장 (NURSING_DIRECTOR) |
| admin | 시스템관리자 | 관리자 (ADMIN) |

## 주요 명령어

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드 (prisma generate + db push + next build)
npm run lint         # ESLint
npx prisma db push   # 스키마 동기화
npx prisma db seed   # 시드 데이터 입력
npx tsc --noEmit     # 타입 체크
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/                    # API Routes (21개)
│   │   ├── auth/               # 인증 (login, logout, me)
│   │   ├── dashboard/          # 대시보드 통계
│   │   ├── nurses/             # 간호사 CRUD
│   │   ├── schedules/          # 근무표 CRUD
│   │   │   └── [id]/
│   │   │       ├── entries/    # 근무 배정 저장/조회
│   │   │       ├── generate/   # AI 자동 편성
│   │   │       ├── preferences/# 선호도 관리
│   │   │       ├── excel/      # Excel 내보내기
│   │   │       ├── history/    # 변경 이력
│   │   │       ├── previous/   # 전월 참조
│   │   │       ├── print/      # 인쇄 로그
│   │   │       └── stats/      # 간호사별 통계
│   │   ├── seed/               # DB 시드
│   │   ├── shift-types/        # 근무 유형 관리
│   │   └── wards/              # 병동 관리
│   ├── login/                  # 로그인 페이지
│   ├── dashboard/              # 대시보드
│   ├── nurses/                 # 간호사 관리
│   └── schedules/              # 근무표 목록 + 편집기
├── components/
│   ├── layout/                 # Sidebar, Header, Providers
│   ├── schedule/               # ScheduleGrid, ShiftCell, ChangeHistory,
│   │                           # GenerateScheduleModal, PreferenceEditor, PrintLayout
│   └── ui/                     # Button, Badge, Modal, ThemeToggle
├── lib/
│   ├── scheduling/             # AI 편성 알고리즘 (6단계 + SA)
│   ├── korean-holidays.ts      # 한국 공휴일 (2024-2030)
│   ├── auth.ts                 # JWT 인증 헬퍼
│   ├── prisma.ts               # PrismaClient 싱글턴
│   └── utils.ts                # 유틸리티
├── store/schedule.ts           # Zustand 그리드 상태
├── contexts/                   # AuthContext, SidebarContext
├── types/                      # TypeScript 타입 정의
└── middleware.ts               # JWT 인증 미들웨어
```

## 데이터 모델

```
Ward ──1:N──→ Nurse ──1:N──→ ScheduleEntry
  │                  └──1:N──→ ScheduleSummary
  │                  └──1:N──→ NursePreference
  └──1:N──→ Schedule ──1:N──→ ScheduleEntry
                │     └──1:N──→ ScheduleSummary
                │     └──1:N──→ ScheduleApproval
                │     └──1:N──→ ScheduleChangeLog
                │     └──1:N──→ SchedulePrintLog
                └──N:1──→ User
```

## 근무 유형

| 코드 | 의미 | 비고 |
|------|------|------|
| D | 주간 (Day) | 근무일 |
| E | 저녁 (Evening) | 근무일 |
| N | 야간 (Night) | 근무일 |
| T | 교육 (Training) | - |
| O | 공휴 (Holiday Off) | 비근무일 |
| X | 휴무 (Off) | 비근무일 |
| B | 기타 (Other) | - |

## 배포

- **Platform**: Vercel
- **DB (local)**: SQLite — `DATABASE_URL="file:./dev.db"`
- **DB (production)**: PostgreSQL (Neon) — `prisma/schema.prisma` provider를 `postgresql`로 변경
- **환경변수**: `DATABASE_URL`, `JWT_SECRET`

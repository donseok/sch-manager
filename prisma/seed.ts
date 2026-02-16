import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. 근무 유형 마스터 데이터
  const shiftTypes = [
    { code: "D", name: "Day", description: "주간근무", colorCode: "#FEF3C7", isWorkingDay: true, displayOrder: 1 },
    { code: "E", name: "Evening", description: "오후근무", colorCode: "#DBEAFE", isWorkingDay: true, displayOrder: 2 },
    { code: "N", name: "Night", description: "야간근무", colorCode: "#EDE9FE", isWorkingDay: true, displayOrder: 3 },
    { code: "T", name: "Training", description: "교육", colorCode: "#FFEDD5", isWorkingDay: true, displayOrder: 4 },
    { code: "O", name: "Off", description: "오프", colorCode: "#D1FAE5", isWorkingDay: false, displayOrder: 5 },
    { code: "X", name: "휴무", description: "휴무", colorCode: "#F3F4F6", isWorkingDay: false, displayOrder: 6 },
    { code: "B", name: "기타", description: "기타근무", colorCode: "#FCE7F3", isWorkingDay: true, displayOrder: 7 },
  ];

  for (const st of shiftTypes) {
    await prisma.shiftType.upsert({
      where: { code: st.code },
      update: st,
      create: st,
    });
  }
  console.log("근무유형 시드 완료");

  // 2. 42병동 생성
  const ward42 = await prisma.ward.upsert({
    where: { wardCode: "42" },
    update: {},
    create: {
      wardCode: "42",
      wardName: "42병동",
      description: "42병동 간호단위",
    },
  });
  console.log("병동 시드 완료");

  // 3. 간호사 20명 생성
  const nurseData = [
    { employeeNumber: "N2024001", name: "김미영", position: "HN", positionRank: 1, sortOrder: 1 },
    { employeeNumber: "N2024002", name: "이수진", position: "CN", positionRank: 2, sortOrder: 2 },
    { employeeNumber: "N2024003", name: "박지현", position: "CN", positionRank: 2, sortOrder: 3 },
    { employeeNumber: "N2024004", name: "최은주", position: "AN", positionRank: 3, sortOrder: 4 },
    { employeeNumber: "N2024005", name: "정하나", position: "AN", positionRank: 3, sortOrder: 5 },
    { employeeNumber: "N2024006", name: "강서연", position: "RN", positionRank: 4, sortOrder: 6 },
    { employeeNumber: "N2024007", name: "윤다은", position: "RN", positionRank: 4, sortOrder: 7 },
    { employeeNumber: "N2024008", name: "임소라", position: "RN", positionRank: 4, sortOrder: 8 },
    { employeeNumber: "N2024009", name: "한지영", position: "RN", positionRank: 4, sortOrder: 9 },
    { employeeNumber: "N2024010", name: "오민지", position: "RN", positionRank: 4, sortOrder: 10 },
    { employeeNumber: "N2024011", name: "서유나", position: "RN", positionRank: 4, sortOrder: 11 },
    { employeeNumber: "N2024012", name: "조현아", position: "RN", positionRank: 4, sortOrder: 12 },
    { employeeNumber: "N2024013", name: "신예진", position: "RN", positionRank: 4, sortOrder: 13 },
    { employeeNumber: "N2024014", name: "권나래", position: "RN", positionRank: 4, sortOrder: 14 },
    { employeeNumber: "N2024015", name: "황수빈", position: "RN", positionRank: 4, sortOrder: 15 },
    { employeeNumber: "N2024016", name: "배지은", position: "RN", positionRank: 4, sortOrder: 16 },
    { employeeNumber: "N2024017", name: "류하린", position: "RN", positionRank: 4, sortOrder: 17 },
    { employeeNumber: "N2024018", name: "송다영", position: "RN", positionRank: 4, sortOrder: 18 },
    { employeeNumber: "N2024019", name: "전소희", position: "RN", positionRank: 4, sortOrder: 19 },
    { employeeNumber: "N2024020", name: "홍세라", position: "RN", positionRank: 4, sortOrder: 20 },
  ];

  const nurses: any[] = [];
  for (const n of nurseData) {
    const nurse = await prisma.nurse.upsert({
      where: { employeeNumber: n.employeeNumber },
      update: {},
      create: { ...n, wardId: ward42.id },
    });
    nurses.push(nurse);
  }
  console.log("간호사 시드 완료");

  // 4. 사용자 계정 생성
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = [
    { loginId: "headnurse", name: "김미영", role: "HEAD_NURSE", nurseId: nurses[0].id, wardId: ward42.id },
    { loginId: "manager", name: "이정숙", role: "NURSING_MANAGER", nurseId: null, wardId: null },
    { loginId: "director", name: "박영희", role: "NURSING_DIRECTOR", nurseId: null, wardId: null },
    { loginId: "admin", name: "시스템관리자", role: "ADMIN", nurseId: null, wardId: null },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { loginId: u.loginId },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  console.log("사용자 계정 시드 완료");
  console.log("\n=== 시드 데이터 적용 완료 ===");
  console.log("로그인 계정:");
  console.log("  headnurse / password123 (수간호사)");
  console.log("  manager / password123 (간호과장)");
  console.log("  director / password123 (간호부장)");
  console.log("  admin / password123 (관리자)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

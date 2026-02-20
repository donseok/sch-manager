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

  // 3. 간호사 생성 (42병동 사원정보)
  const nurseData = [
    { employeeNumber: "10400133", name: "진인숙", position: "HN", positionRank: 1, sortOrder: 1 },
    { employeeNumber: "10400188", name: "김경선", position: "CN", positionRank: 2, sortOrder: 2 },
    { employeeNumber: "10400527", name: "서유리", position: "RN", positionRank: 4, sortOrder: 3 },
    { employeeNumber: "10400954", name: "이지민", position: "RN", positionRank: 4, sortOrder: 4 },
    { employeeNumber: "10400962", name: "이동병", position: "RN", positionRank: 4, sortOrder: 5 },
    { employeeNumber: "10400993", name: "강문영", position: "RN", positionRank: 4, sortOrder: 6 },
    { employeeNumber: "10401055", name: "정은우", position: "RN", positionRank: 4, sortOrder: 7 },
    { employeeNumber: "10401056", name: "신서영", position: "RN", positionRank: 4, sortOrder: 8 },
    { employeeNumber: "10401071", name: "양은정", position: "RN", positionRank: 4, sortOrder: 9 },
    { employeeNumber: "10401132", name: "장현지", position: "RN", positionRank: 4, sortOrder: 10 },
    { employeeNumber: "10401137", name: "우영호", position: "RN", positionRank: 4, sortOrder: 11 },
    { employeeNumber: "10401138", name: "김예림", position: "RN", positionRank: 4, sortOrder: 12 },
    { employeeNumber: "10401120", name: "박성주", position: "RN", positionRank: 4, sortOrder: 13 },
    { employeeNumber: "10400856", name: "조혜민", position: "RN", positionRank: 4, sortOrder: 14 },
    { employeeNumber: "10400857", name: "구다해", position: "RN", positionRank: 4, sortOrder: 15 },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // 4. 시스템 사용자 계정 생성 (bcrypt 해싱)
  const defaultPasswordHash = await bcrypt.hash("1234", 10);

  const users = [
    { loginId: "headnurse", name: "진인숙", role: "HEAD_NURSE", nurseId: nurses[0].id, wardId: ward42.id },
    { loginId: "chargenurse", name: "김경선", role: "HEAD_NURSE", nurseId: nurses[1].id, wardId: ward42.id },
    { loginId: "manager", name: "이정숙", role: "NURSING_MANAGER", nurseId: null, wardId: null },
    { loginId: "director", name: "박영희", role: "NURSING_DIRECTOR", nurseId: null, wardId: null },
    { loginId: "admin", name: "시스템관리자", role: "ADMIN", nurseId: null, wardId: null },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { loginId: u.loginId },
      update: { passwordHash: defaultPasswordHash, name: u.name, role: u.role },
      create: { ...u, passwordHash: defaultPasswordHash },
    });
  }
  console.log("사용자 계정 시드 완료");
  console.log("\n=== 시드 데이터 적용 완료 ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

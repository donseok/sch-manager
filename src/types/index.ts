import type {
  Ward,
  Nurse,
  User,
  ShiftType,
  Schedule,
  ScheduleEntry,
  ScheduleSummary,
  ScheduleChangeLog,
  SchedulePrintLog,
} from "@prisma/client";

export type {
  Ward,
  Nurse,
  User,
  ShiftType,
  Schedule,
  ScheduleEntry,
  ScheduleSummary,
  ScheduleChangeLog,
  SchedulePrintLog,
};

export type ScheduleEntryWithNurse = ScheduleEntry & {
  nurse: Nurse;
};

export type ScheduleWithRelations = Schedule & {
  ward: Ward;
  createdBy: Pick<User, "id" | "name">;
  confirmedBy?: Pick<User, "id" | "name"> | null;
  entries: ScheduleEntryWithNurse[];
  summaries: (ScheduleSummary & { nurse: Nurse })[];
};

export type NurseWithWard = Nurse & {
  ward: Ward;
};

export type ScheduleGridData = {
  nurseId: string;
  nurseName: string;
  employeeNumber: string;
  position: string;
  sortOrder: number;
  entries: Record<number, string>;
  summary: {
    D: number;
    E: number;
    N: number;
    T: number;
    X: number;
    O: number;
    XO: number;
  };
};

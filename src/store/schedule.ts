import { create } from "zustand";
import type { ScheduleGridData } from "@/types";

interface ScheduleStore {
  gridData: ScheduleGridData[];
  isDirty: boolean;
  selectedCell: { nurseId: string; day: number } | null;

  setGridData: (data: ScheduleGridData[]) => void;
  updateCell: (nurseId: string, day: number, shiftCode: string) => void;
  setSelectedCell: (cell: { nurseId: string; day: number } | null) => void;
  setDirty: (dirty: boolean) => void;
  recalculateSummary: (nurseId: string) => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  gridData: [],
  isDirty: false,
  selectedCell: null,

  setGridData: (data) => set({ gridData: data, isDirty: false }),

  updateCell: (nurseId, day, shiftCode) => {
    set((state) => {
      const newData = state.gridData.map((row) => {
        if (row.nurseId !== nurseId) return row;
        return {
          ...row,
          entries: { ...row.entries, [day]: shiftCode },
        };
      });
      return { gridData: newData, isDirty: true };
    });
    get().recalculateSummary(nurseId);
  },

  setSelectedCell: (cell) => set({ selectedCell: cell }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  recalculateSummary: (nurseId) => {
    set((state) => {
      const newData = state.gridData.map((row) => {
        if (row.nurseId !== nurseId) return row;
        const counts = { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 };
        Object.values(row.entries).forEach((code) => {
          if (code in counts) {
            counts[code as keyof typeof counts]++;
          }
        });
        counts.XO = counts.X + counts.O;
        return { ...row, summary: counts };
      });
      return { gridData: newData };
    });
  },
}));

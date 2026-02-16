import { create } from "zustand";
import type { ScheduleGridData } from "@/types";

interface CellUpdate {
  nurseId: string;
  day: number;
  shiftCode: string;
}

interface ScheduleStore {
  gridData: ScheduleGridData[];
  isDirty: boolean;
  selectedCell: { nurseId: string; day: number } | null;

  setGridData: (data: ScheduleGridData[]) => void;
  updateCell: (nurseId: string, day: number, shiftCode: string) => void;
  updateCells: (updates: CellUpdate[]) => void;
  setSelectedCell: (cell: { nurseId: string; day: number } | null) => void;
  setDirty: (dirty: boolean) => void;
  recalculateSummary: (nurseId: string) => void;
  addNurse: (nurse: ScheduleGridData) => void;
  removeNurse: (nurseId: string) => void;
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

  updateCells: (updates) => {
    if (updates.length === 0) return;

    // Build a map of nurseId -> { day -> shiftCode }
    const changeMap = new Map<string, Record<number, string>>();
    for (const { nurseId, day, shiftCode } of updates) {
      if (!changeMap.has(nurseId)) changeMap.set(nurseId, {});
      changeMap.get(nurseId)![day] = shiftCode;
    }

    set((state) => {
      const newData = state.gridData.map((row) => {
        const changes = changeMap.get(row.nurseId);
        if (!changes) return row;
        const newEntries = { ...row.entries };
        for (const [day, code] of Object.entries(changes)) {
          if (code === "") {
            delete newEntries[Number(day)];
          } else {
            newEntries[Number(day)] = code;
          }
        }
        // Recalculate summary inline
        const counts = { D: 0, E: 0, N: 0, T: 0, X: 0, O: 0, XO: 0 };
        Object.values(newEntries).forEach((c) => {
          if (c in counts) {
            counts[c as keyof typeof counts]++;
          }
        });
        counts.XO = counts.X + counts.O;
        return { ...row, entries: newEntries, summary: counts };
      });
      return { gridData: newData, isDirty: true };
    });
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

  addNurse: (nurse) => {
    set((state) => ({
      gridData: [...state.gridData, nurse],
      isDirty: true,
    }));
  },

  removeNurse: (nurseId) => {
    set((state) => ({
      gridData: state.gridData.filter((row) => row.nurseId !== nurseId),
      isDirty: true,
    }));
  },
}));

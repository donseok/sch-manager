-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_code" TEXT NOT NULL,
    "ward_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "nurses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "position_rank" INTEGER NOT NULL DEFAULT 0,
    "ward_id" TEXT NOT NULL,
    "employment_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "hire_date" DATETIME,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "nurses_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "login_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "nurse_id" TEXT,
    "ward_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "nurses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shift_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color_code" TEXT,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "confirmed_at" DATETIME,
    "confirmed_by" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schedules_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "schedules_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "nurse_id" TEXT NOT NULL,
    "work_date" DATETIME NOT NULL,
    "shift_type_code" TEXT NOT NULL,
    "is_modified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schedule_entries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedule_entries_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "nurses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "nurse_id" TEXT NOT NULL,
    "count_d" INTEGER NOT NULL DEFAULT 0,
    "count_e" INTEGER NOT NULL DEFAULT 0,
    "count_n" INTEGER NOT NULL DEFAULT 0,
    "count_t" INTEGER NOT NULL DEFAULT 0,
    "count_x" INTEGER NOT NULL DEFAULT 0,
    "count_o" INTEGER NOT NULL DEFAULT 0,
    "count_xo" INTEGER NOT NULL DEFAULT 0,
    "total_working_days" INTEGER NOT NULL DEFAULT 0,
    "total_off_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schedule_summaries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedule_summaries_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "nurses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "approval_step" INTEGER NOT NULL,
    "approval_role" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "acted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_approvals_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedule_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "nurse_id" TEXT NOT NULL,
    "work_date" DATETIME NOT NULL,
    "previous_shift_code" TEXT,
    "new_shift_code" TEXT NOT NULL,
    "change_reason" TEXT,
    "changed_by" TEXT NOT NULL,
    "version_before" INTEGER NOT NULL,
    "version_after" INTEGER NOT NULL,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_change_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedule_change_logs_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "nurses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "schedule_change_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_print_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT NOT NULL,
    "printed_by" TEXT NOT NULL,
    "print_format" TEXT NOT NULL DEFAULT 'PDF',
    "printed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_print_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedule_print_logs_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "wards_ward_code_key" ON "wards"("ward_code");

-- CreateIndex
CREATE UNIQUE INDEX "nurses_employee_number_key" ON "nurses"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_nurse_id_key" ON "users"("nurse_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_types_code_key" ON "shift_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_ward_id_year_month_version_key" ON "schedules"("ward_id", "year", "month", "version");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_entries_schedule_id_nurse_id_work_date_key" ON "schedule_entries"("schedule_id", "nurse_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_summaries_schedule_id_nurse_id_key" ON "schedule_summaries"("schedule_id", "nurse_id");

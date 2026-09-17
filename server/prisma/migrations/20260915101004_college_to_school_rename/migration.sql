-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('draft', 'published', 'ongoing', 'completed');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "adminEmail" TEXT NOT NULL,
    "adminPasswordHash" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "SchoolStatus" NOT NULL DEFAULT 'TRIAL',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "terminatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "maxStudents" INTEGER NOT NULL DEFAULT 2000,
    "maxRooms" INTEGER NOT NULL DEFAULT 50,
    "maxFaculty" INTEGER NOT NULL DEFAULT 200,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enrollmentNo" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "parentName" TEXT,
    "parentEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "rows" INTEGER NOT NULL,
    "benchesPerRow" INTEGER NOT NULL,
    "defaultSeatsPerBench" INTEGER NOT NULL,
    "hasCustomRowConfig" BOOLEAN NOT NULL DEFAULT false,
    "rowConfig" JSONB NOT NULL DEFAULT '[]',
    "seats" JSONB NOT NULL DEFAULT '[]',
    "totalCapacity" INTEGER NOT NULL DEFAULT 0,
    "usableCapacity" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'draft',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "selectedClassIds" TEXT[],
    "selectedSectionIds" TEXT[],
    "studentIds" TEXT[],
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "totalAvailableSeats" INTEGER NOT NULL DEFAULT 0,
    "seatingRules" JSONB NOT NULL DEFAULT '{}',
    "planGenerated" BOOLEAN NOT NULL DEFAULT false,
    "planGeneratedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRoom" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "usableCapacity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShiftRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatingAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "bench" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvigilatorAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvigilatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "School_adminEmail_key" ON "School"("adminEmail");

-- CreateIndex
CREATE INDEX "School_status_idx" ON "School"("status");

-- CreateIndex
CREATE INDEX "School_renewalDate_idx" ON "School"("renewalDate");

-- CreateIndex
CREATE INDEX "Session_schoolId_isActive_idx" ON "Session"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Session_schoolId_name_key" ON "Session"("schoolId", "name");

-- CreateIndex
CREATE INDEX "ActivityLog_schoolId_performedAt_idx" ON "ActivityLog"("schoolId", "performedAt");

-- CreateIndex
CREATE INDEX "Class_schoolId_sessionId_idx" ON "Class"("schoolId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_sessionId_name_key" ON "Class"("sessionId", "name");

-- CreateIndex
CREATE INDEX "Section_schoolId_sessionId_classId_idx" ON "Section"("schoolId", "sessionId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_classId_name_key" ON "Section"("classId", "name");

-- CreateIndex
CREATE INDEX "Faculty_schoolId_idx" ON "Faculty"("schoolId");

-- CreateIndex
CREATE INDEX "Faculty_email_isActive_idx" ON "Faculty"("email", "isActive");

-- CreateIndex
CREATE INDEX "Faculty_schoolId_isActive_idx" ON "Faculty"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_schoolId_email_key" ON "Faculty"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_schoolId_employeeId_key" ON "Faculty"("schoolId", "employeeId");

-- CreateIndex
CREATE INDEX "Student_schoolId_sessionId_classId_sectionId_idx" ON "Student"("schoolId", "sessionId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "Student_sessionId_enrollmentNo_idx" ON "Student"("sessionId", "enrollmentNo");

-- CreateIndex
CREATE INDEX "Student_schoolId_sessionId_isActive_idx" ON "Student"("schoolId", "sessionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Student_sessionId_enrollmentNo_key" ON "Student"("sessionId", "enrollmentNo");

-- CreateIndex
CREATE INDEX "Room_schoolId_isActive_idx" ON "Room"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Room_schoolId_name_key" ON "Room"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Exam_schoolId_sessionId_status_idx" ON "Exam"("schoolId", "sessionId", "status");

-- CreateIndex
CREATE INDEX "Exam_schoolId_sessionId_examDate_idx" ON "Exam"("schoolId", "sessionId", "examDate");

-- CreateIndex
CREATE INDEX "Shift_schoolId_examId_idx" ON "Shift"("schoolId", "examId");

-- CreateIndex
CREATE INDEX "Shift_schoolId_examId_planGenerated_idx" ON "Shift"("schoolId", "examId", "planGenerated");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_examId_name_key" ON "Shift"("examId", "name");

-- CreateIndex
CREATE INDEX "ShiftRoom_shiftId_idx" ON "ShiftRoom"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRoom_shiftId_roomId_key" ON "ShiftRoom"("shiftId", "roomId");

-- CreateIndex
CREATE INDEX "SeatingAssignment_schoolId_examId_shiftId_roomId_idx" ON "SeatingAssignment"("schoolId", "examId", "shiftId", "roomId");

-- CreateIndex
CREATE INDEX "SeatingAssignment_studentId_idx" ON "SeatingAssignment"("studentId");

-- CreateIndex
CREATE INDEX "SeatingAssignment_shiftId_roomId_idx" ON "SeatingAssignment"("shiftId", "roomId");

-- CreateIndex
CREATE INDEX "SeatingAssignment_studentId_shiftId_idx" ON "SeatingAssignment"("studentId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatingAssignment_shiftId_studentId_key" ON "SeatingAssignment"("shiftId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatingAssignment_shiftId_roomId_seatId_key" ON "SeatingAssignment"("shiftId", "roomId", "seatId");

-- CreateIndex
CREATE INDEX "InvigilatorAssignment_shiftId_facultyId_idx" ON "InvigilatorAssignment"("shiftId", "facultyId");

-- CreateIndex
CREATE INDEX "InvigilatorAssignment_facultyId_idx" ON "InvigilatorAssignment"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "InvigilatorAssignment_shiftId_roomId_facultyId_key" ON "InvigilatorAssignment"("shiftId", "roomId", "facultyId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRoom" ADD CONSTRAINT "ShiftRoom_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRoom" ADD CONSTRAINT "ShiftRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingAssignment" ADD CONSTRAINT "SeatingAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingAssignment" ADD CONSTRAINT "SeatingAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingAssignment" ADD CONSTRAINT "SeatingAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingAssignment" ADD CONSTRAINT "SeatingAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingAssignment" ADD CONSTRAINT "SeatingAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingAssignment" ADD CONSTRAINT "SeatingAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilatorAssignment" ADD CONSTRAINT "InvigilatorAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilatorAssignment" ADD CONSTRAINT "InvigilatorAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilatorAssignment" ADD CONSTRAINT "InvigilatorAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilatorAssignment" ADD CONSTRAINT "InvigilatorAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilatorAssignment" ADD CONSTRAINT "InvigilatorAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvigilatorAssignment" ADD CONSTRAINT "InvigilatorAssignment_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { prisma } = require("../config/db");

const studentLookup = asyncHandler(async (req, res) => {
  const { enrollmentNo } = req.params;

  const student = await prisma.student.findFirst({
    where: { enrollmentNo, isActive: true },
    include: { class: { select: { name: true } }, section: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!student) throw new ApiError(404, "Student not found");

  const assignments = await prisma.seatingAssignment.findMany({
    where: { studentId: student.id },
    include: {
      room: { select: { name: true, building: true, floor: true } },
      shift: { select: { name: true, startTime: true, endTime: true, isPublished: true } },
      exam: { select: { title: true, academicYear: true, examDate: true, status: true } },
    },
  });

  const published = assignments.filter((a) => a.shift?.isPublished);

  res.json(new ApiResponse(200, "Student found", {
    student: { name: student.name, enrollmentNo: student.enrollmentNo, class: student.class?.name, section: student.section?.name },
    seatAssignments: published.map((a) => ({
      exam: a.exam?.title, academicYear: a.exam?.academicYear, examDate: a.exam?.examDate,
      shift: a.shift?.name, time: `${a.shift?.startTime} – ${a.shift?.endTime}`,
      room: a.room?.name, building: a.room?.building, seatId: a.seatId,
    })),
  }));
});

const facultyLookup = asyncHandler(async (req, res) => {
  const { email } = req.params;

  const faculty = await prisma.faculty.findFirst({
    where: { email, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!faculty) throw new ApiError(404, "Faculty not found");

  const duties = await prisma.invigilatorAssignment.findMany({
    where: { facultyId: faculty.id },
    include: {
      room: { select: { name: true, building: true, floor: true } },
      shift: { select: { name: true, startTime: true, endTime: true, isPublished: true } },
      exam: { select: { title: true, academicYear: true, examDate: true, status: true } },
    },
  });

  const published = duties.filter((d) => d.shift?.isPublished);

  res.json(new ApiResponse(200, "Faculty found", {
    faculty: { name: faculty.name, email: faculty.email, designation: faculty.designation },
    dutyAssignments: published.map((d) => ({
      exam: d.exam?.title, academicYear: d.exam?.academicYear, examDate: d.exam?.examDate,
      shift: d.shift?.name, time: `${d.shift?.startTime} – ${d.shift?.endTime}`,
      room: d.room?.name, building: d.room?.building, floor: d.room?.floor,
    })),
  }));
});

module.exports = { studentLookup, facultyLookup };
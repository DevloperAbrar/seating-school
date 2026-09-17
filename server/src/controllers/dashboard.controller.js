const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const { prisma } = require("../config/db");

const getDashboard = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;
  const sessionId = req.sessionId;

  // Students are session-scoped (a student belongs to one academic year),
  // Faculty and Rooms are school-scoped (persist across years), Exams are
  // session-scoped.
  const [students, faculty, rooms, exams, recentLogs, examsByStatus] = await Promise.all([
    prisma.student.count({ where: { schoolId, sessionId, isActive: true } }),
    prisma.faculty.count({ where: { schoolId, isActive: true } }),
    prisma.room.count({ where: { schoolId, isActive: true } }),
    prisma.exam.count({ where: { schoolId, sessionId } }),
    prisma.activityLog.findMany({
      where: { schoolId },
      orderBy: { performedAt: "desc" },
      take: 10,
    }),
    prisma.exam.groupBy({
      by: ["status"],
      where: { schoolId, sessionId },
      _count: { status: true },
    }),
  ]);

  const statusMap = {};
  examsByStatus.forEach((e) => (statusMap[e.status] = e._count.status));

  res.json(new ApiResponse(200, "Dashboard data", {
    stats: { students, faculty, rooms, exams },
    examsByStatus: statusMap,
    recentActivity: recentLogs,
  }));
});

module.exports = { getDashboard };

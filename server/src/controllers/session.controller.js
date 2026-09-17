const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { prisma } = require("../config/db");

// ─── SESSIONS (ACADEMIC YEARS) ───────────────────────────────────────────────
// This is the fix for "data lost every year": every Class/Section/Student/
// Exam is scoped to a sessionId. Creating a new session never touches old
// rows — old years stay intact and browsable forever.

const getSessions = asyncHandler(async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { schoolId: req.schoolId },
    orderBy: { startDate: "desc" },
  });
  res.json(new ApiResponse(200, "Sessions fetched", sessions));
});

const getActiveSession = asyncHandler(async (req, res) => {
  const session = await prisma.session.findFirst({ where: { schoolId: req.schoolId, isActive: true } });
  if (!session) throw new ApiError(404, "No active session set");
  res.json(new ApiResponse(200, "Active session fetched", session));
});

const createSession = asyncHandler(async (req, res) => {
  const { name, startDate, endDate, cloneFromSessionId, makeActive } = req.body;
  if (!name || !startDate || !endDate) throw new ApiError(400, "name, startDate, endDate required");

  const session = await prisma.$transaction(async (tx) => {
    const newSession = await tx.session.create({
      data: {
        schoolId: req.schoolId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: false,
      },
    });

    // Optional: clone Class/Section structure (NOT students) from a
    // previous session, so admin doesn't re-type "Class 9", "Commerce - A"
    // etc every year. Students are intentionally never cloned — each
    // year's roster is entered fresh (or via a separate promotion flow).
    if (cloneFromSessionId) {
      const oldClasses = await tx.class.findMany({
        where: { schoolId: req.schoolId, sessionId: cloneFromSessionId },
        include: { sections: true },
      });

      for (const oldClass of oldClasses) {
        const newClass = await tx.class.create({
          data: {
            schoolId: req.schoolId,
            sessionId: newSession.id,
            name: oldClass.name,
            order: oldClass.order,
          },
        });
        if (oldClass.sections.length) {
          await tx.section.createMany({
            data: oldClass.sections.map((s) => ({
              schoolId: req.schoolId,
              sessionId: newSession.id,
              classId: newClass.id,
              name: s.name,
            })),
          });
        }
      }
    }

    if (makeActive) {
      await tx.session.updateMany({ where: { schoolId: req.schoolId }, data: { isActive: false } });
      await tx.session.update({ where: { id: newSession.id }, data: { isActive: true } });
    }

    return newSession;
  });

  res.status(201).json(new ApiResponse(201, "Session created", session));
});

const activateSession = asyncHandler(async (req, res) => {
  const session = await prisma.session.findFirst({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!session) throw new ApiError(404, "Session not found");

  await prisma.$transaction([
    prisma.session.updateMany({ where: { schoolId: req.schoolId }, data: { isActive: false } }),
    prisma.session.update({ where: { id: session.id }, data: { isActive: true } }),
  ]);

  res.json(new ApiResponse(200, "Session activated"));
});

const updateSession = asyncHandler(async (req, res) => {
  const existing = await prisma.session.findFirst({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!existing) throw new ApiError(404, "Session not found");

  const { name, startDate, endDate } = req.body;
  const session = await prisma.session.update({
    where: { id: req.params.id },
    data: { name, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
  });
  res.json(new ApiResponse(200, "Session updated", session));
});

// Deliberately no deleteSession — a session accumulates a year of exam
// history; deleting it would defeat the entire point of this feature.
// If truly needed later, add a soft "archive" flag instead of hard delete.

module.exports = { getSessions, getActiveSession, createSession, updateSession, activateSession };

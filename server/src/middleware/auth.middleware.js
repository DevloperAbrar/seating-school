const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { prisma } = require("../config/db");


// Verifies JWT cookie and attaches req.user = { role, email, schoolId? }
const authMiddleware = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.admin_token;
  if (!token) throw new ApiError(401, "Unauthorized — please login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired session — please login again");
  }
});

const superAdminAuthMiddleware = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.superadmin_token;
  if (!token) throw new ApiError(401, "Unauthorized — please login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired session — please login again");
  }
});


// Only Anthropic-style super admin (you) can pass
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "SUPER_ADMIN") throw new ApiError(403, "Super admin access required");
  next();
};

// Lighter than tenantMiddleware: verifies school admin + loads school,
// but does NOT require an active Session. Use this for session routes,
// since creating the first session must work before any session exists.
const requireSchoolAdmin = asyncHandler(async (req, res, next) => {
  if (req.user?.role !== "SCHOOL_ADMIN" || !req.user?.schoolId) {
    throw new ApiError(403, "School admin access required");
  }

  const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } });
  if (!school) throw new ApiError(401, "School not found — please login again");

  if (school.status === "TERMINATED") throw new ApiError(403, "This account has been terminated. Contact support.");
  if (school.status === "SUSPENDED") throw new ApiError(403, "This account is suspended. Contact support to reactivate.");

  req.school = school;
  req.schoolId = school.id;
  next();
});

// For all /admin/* school routes: loads the tenant, checks subscription
// status + expiry, and scopes every downstream query via req.schoolId.
//
// It also resolves req.sessionId — the academic year every Class/Section/
// Student/Exam is scoped to. Resolution order:
//   1. ?session=<id> query param — lets an admin browse a past year
//      read-only (e.g. viewing last year's results). Verified to belong
//      to this school before being trusted.
//   2. The school's Session where isActive = true — the normal case.
// If neither resolves, the admin is told to create/activate a session
// rather than every downstream query silently scoping to nothing.
const tenantMiddleware = asyncHandler(async (req, res, next) => {
  if (req.user?.role !== "SCHOOL_ADMIN" || !req.user?.schoolId) {
    throw new ApiError(403, "School admin access required");
  }

  const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } });
  if (!school) throw new ApiError(401, "School not found — please login again");

  if (school.status === "TERMINATED") throw new ApiError(403, "This account has been terminated. Contact support.");
  if (school.status === "SUSPENDED") throw new ApiError(403, "This account is suspended. Contact support to reactivate.");

  if (school.renewalDate < new Date() && school.status !== "TRIAL") {
    // Auto-suspend on expiry so stale sessions can't keep working
    await prisma.school.update({ where: { id: school.id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    throw new ApiError(403, "Your subscription has expired. Please renew to continue.");
  }

  req.school = school;
  req.schoolId = school.id;

  // Resolve active/requested academic session
  let session = null;
  if (req.query.session) {
    session = await prisma.session.findFirst({ where: { id: req.query.session, schoolId: school.id } });
    if (!session) throw new ApiError(404, "Requested session not found for this school");
  } else {
    session = await prisma.session.findFirst({ where: { schoolId: school.id, isActive: true } });
  }

  if (!session) {
    throw new ApiError(409, "No active academic session — create or activate a session first");
  }

  req.session = session;
  req.sessionId = session.id;
  next();
});

const checkLocked = asyncHandler(async (req, res, next) => {
  const exam = await prisma.exam.findFirst({ where: { id: req.params.examId, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (exam.isLocked) throw new ApiError(403, "Exam is locked — no changes allowed after exam date");
  next();
});

const checkPublished = asyncHandler(async (req, res, next) => {
  const shift = await prisma.shift.findFirst({ where: { id: req.params.shiftId, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!shift) throw new ApiError(404, "Shift not found");
  if (shift.isPublished && req.method !== "GET") throw new ApiError(403, "Seating plan is published — unpublish first to make changes");
  next();
});

module.exports = {
  authMiddleware,
  superAdminAuthMiddleware,
  requireSuperAdmin,
  tenantMiddleware,
  requireSchoolAdmin,
  checkLocked,
  checkPublished,
};
const express = require("express");
const rateLimit = require("express-rate-limit");
const { LOGIN_RATE_LIMIT, PUBLIC_RATE_LIMIT } = require("../config/constants");
const { authMiddleware, tenantMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

const loginLimiter = rateLimit({ ...LOGIN_RATE_LIMIT, message: { success: false, statusCode: 429, message: "Too many login attempts — try after 15 minutes" } });
const publicLimiter = rateLimit({ ...PUBLIC_RATE_LIMIT, message: { success: false, statusCode: 429, message: "Too many requests" } });

// Super admin — you only
router.use("/superadmin", loginLimiter, require("./superadmin.routes"));

// School admin auth
router.use("/admin/auth", loginLimiter, require("./auth.routes"));

// Every other /admin/* route is tenant-scoped: verify JWT, then verify
// school is active AND resolve the active academic session (req.sessionId).
// Session routes are mounted separately, BEFORE this line's session
// resolution requirement would apply to them — session management itself
// (list/create/activate) only needs the school to be known, not a session
// to already be active (chicken-and-egg on a school's very first login).
router.use("/admin/sessions", authMiddleware, require("./session.routes"));

router.use("/admin", authMiddleware, tenantMiddleware);
router.use("/admin/dashboard", require("./academic.routes").dashboardRouter);
router.use("/admin/academic", require("./academic.routes").router);
router.use("/admin/students", require("./student.routes"));
router.use("/admin/faculty", require("./faculty.routes"));
router.use("/admin/rooms", require("./room.routes"));
router.use("/admin/exams", require("./exam.routes"));

router.use("/public", publicLimiter, require("./lookup.routes"));

module.exports = router;

const express = require("express");
const superadmin = require("../controllers/superadmin.controller");
const { superAdminAuthMiddleware, requireSuperAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/auth/login", superadmin.login);
router.post("/auth/logout", superAdminAuthMiddleware, requireSuperAdmin, superadmin.logout);

router.use(superAdminAuthMiddleware, requireSuperAdmin); // everything below requires super admin

router.get("/schools", superadmin.listColleges);
router.post("/schools", superadmin.createCollege);
router.get("/schools/:id", superadmin.getCollege);
router.post("/schools/:id/renew", superadmin.renewCollege);
router.post("/schools/:id/reset-password", superadmin.resetAdminPassword);
router.post("/schools/:id/suspend", superadmin.suspendCollege);
router.post("/schools/:id/terminate", superadmin.terminateCollege);
router.post("/schools/:id/reactivate", superadmin.reactivateCollege);
router.get("/generate-password", superadmin.generatePassword);
router.get("/stats", superadmin.platformStats);

module.exports = router;
const express = require("express");
const { requireSchoolAdmin } = require("../middleware/auth.middleware");
const {
  getSessions, getActiveSession, createSession, updateSession, activateSession,
} = require("../controllers/session.controller");

const router = express.Router();
router.use(requireSchoolAdmin);

router.get("/", getSessions);
router.get("/active", getActiveSession);
router.post("/", createSession);
router.put("/:id", updateSession);
router.put("/:id/activate", activateSession);

module.exports = router;
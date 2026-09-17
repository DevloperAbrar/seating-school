const express = require("express");
const { login, logout, me } = require("../controllers/auth.controller");
const { authMiddleware, requireSchoolAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, requireSchoolAdmin, me);

module.exports = router;
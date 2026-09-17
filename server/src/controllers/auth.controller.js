const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { COOKIE_OPTIONS } = require("../config/constants");
const { prisma } = require("../config/db");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const school = await prisma.school.findUnique({ where: { adminEmail: email.toLowerCase() } });
  if (!school) throw new ApiError(401, "Invalid credentials");

  if (school.status === "TERMINATED") throw new ApiError(403, "This account has been terminated.");
  if (school.status === "SUSPENDED") throw new ApiError(403, "This account is suspended. Contact support.");

  const valid = await bcrypt.compare(password, school.adminPasswordHash);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  const token = jwt.sign(
    { email: email.toLowerCase(), role: "SCHOOL_ADMIN", schoolId: school.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || "8h" }
  );

  res.cookie("admin_token", token, COOKIE_OPTIONS);
  res.json(new ApiResponse(200, "Login successful", {
    email: email.toLowerCase(),
    role: "SCHOOL_ADMIN",
    schoolName: school.name,
    schoolCode: school.code,
    plan: school.plan,
    renewalDate: school.renewalDate,
  }));
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("admin_token", { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json(new ApiResponse(200, "Logged out successfully"));
});

const me = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, "Admin info", {
    email: req.user.email,
    role: req.user.role,
    schoolName: req.school.name,
    plan: req.school.plan,
    status: req.school.status,
    renewalDate: req.school.renewalDate,
  }));
});

module.exports = { login, logout, me };
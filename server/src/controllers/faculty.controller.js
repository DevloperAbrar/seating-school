const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { prisma } = require("../config/db");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");

// NOTE: Faculty is school-scoped, not session-scoped — teachers are ongoing
// staff, not tied to one academic year (see schema.prisma). departmentIds
// has been dropped since Department no longer exists in the school model.

const PHONE_REGEX = /^\d{10}$/;

const getFaculty = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const where = { schoolId: req.schoolId, isActive: true };
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search, mode: "insensitive" } },
      { email: { contains: req.query.search, mode: "insensitive" } },
      { employeeId: { contains: req.query.search, mode: "insensitive" } },
    ];
  }

  const [faculty, total] = await Promise.all([
    prisma.faculty.findMany({ where, skip, take: limit, orderBy: { name: "asc" } }),
    prisma.faculty.count({ where }),
  ]);
  res.json(new ApiResponse(200, "Faculty fetched", faculty, buildPaginationMeta(total, page, limit)));
});

const createFaculty = asyncHandler(async (req, res) => {
  const { name, email, employeeId, designation, phone } = req.body;
  if (!name || !email || !employeeId || !designation) throw new ApiError(400, "name, email, employeeId, designation required");

  // ✅ Only validate phone if a value was actually provided (it's optional)
  if (phone && !PHONE_REGEX.test(phone)) {
    throw new ApiError(400, "Phone number must be exactly 10 digits");
  }

  const faculty = await prisma.faculty.create({
    data: {
      schoolId: req.schoolId,
      name, email: email.toLowerCase(), employeeId,
      designation, phone: phone || "",
    },
  });
  res.status(201).json(new ApiResponse(201, "Faculty created", faculty));
});

const updateFaculty = asyncHandler(async (req, res) => {
  const existing = await prisma.faculty.findFirst({
    where: { id: req.params.id, schoolId: req.schoolId },
  });
  if (!existing) throw new ApiError(404, "Faculty not found");

  if (req.body.phone && !PHONE_REGEX.test(req.body.phone)) {
    throw new ApiError(400, "Phone number must be exactly 10 digits");
  }

  // Whitelist: only safe fields
  const { name, email, employeeId, designation, phone } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email.toLowerCase();
  if (employeeId !== undefined) data.employeeId = employeeId;
  if (designation !== undefined) data.designation = designation;
  if (phone !== undefined) data.phone = phone;

  const faculty = await prisma.faculty.update({
    where: { id: req.params.id },
    data,
  });
  res.json(new ApiResponse(200, "Faculty updated", faculty));
});

const deleteFaculty = asyncHandler(async (req, res) => {
  const existing = await prisma.faculty.findFirst({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!existing) throw new ApiError(404, "Faculty not found");

  await prisma.faculty.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json(new ApiResponse(200, "Faculty deactivated"));
});

module.exports = { getFaculty, createFaculty, updateFaculty, deleteFaculty };
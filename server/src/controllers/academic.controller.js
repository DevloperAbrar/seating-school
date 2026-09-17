const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { prisma } = require("../config/db");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");

// NOTE: req.schoolId and req.sessionId are expected to be set by
// auth/session-resolving middleware (see auth.middleware.js changes).
// req.sessionId should resolve to the school's currently-active Session
// unless a specific ?session= query param / header overrides it — that
// override is useful for admins viewing a past year's data read-only.

// ─── CLASSES ────────────────────────────────────────────────────────────────

const getClasses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const where = { schoolId: req.schoolId, sessionId: req.sessionId };
  if (req.query.active !== undefined) where.isActive = req.query.active === "true";

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where, skip, take: limit,
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { sections: { where: { isActive: true }, orderBy: { name: "asc" } } },
    }),
    prisma.class.count({ where }),
  ]);
  res.json(new ApiResponse(200, "Classes fetched", classes, buildPaginationMeta(total, page, limit)));
});

const createClass = asyncHandler(async (req, res) => {
  const { name, order } = req.body;
  if (!name) throw new ApiError(400, "name required");

  const existingClass = await prisma.class.findFirst({
    where: { sessionId: req.sessionId, name: name.trim() },
  });
  if (existingClass) {
    throw new ApiError(409, `Class "${name.trim()}" already exists in this session`);
  }

  const cls = await prisma.class.create({
    data: {
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      name: name.trim(),
      order: order !== undefined ? Number(order) : 0,
    },
  });
  res.status(201).json(new ApiResponse(201, "Class created", cls));
});

const updateClass = asyncHandler(async (req, res) => {
  const existing = await prisma.class.findFirst({ where: { id: req.params.id, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!existing) throw new ApiError(404, "Class not found");

  const { name, order, isActive } = req.body;
  const cls = await prisma.class.update({ where: { id: req.params.id }, data: { name, order, isActive } });
  res.json(new ApiResponse(200, "Class updated", cls));
});

const deleteClass = asyncHandler(async (req, res) => {
  const sections = await prisma.section.count({ where: { classId: req.params.id, schoolId: req.schoolId } });
  if (sections > 0) throw new ApiError(400, "Cannot delete class with existing sections");

  const existing = await prisma.class.findFirst({ where: { id: req.params.id, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!existing) throw new ApiError(404, "Class not found");

  await prisma.class.delete({ where: { id: req.params.id } });
  res.json(new ApiResponse(200, "Class deleted"));
});

// ─── SECTIONS ────────────────────────────────────────────────────────────────
// Fully custom-named, any number per class (e.g. "Commerce - A", "Red House").

const getSections = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const where = { schoolId: req.schoolId, sessionId: req.sessionId };
  if (req.query.class) where.classId = req.query.class;
  if (req.query.active !== undefined) where.isActive = req.query.active === "true";

  const [sections, total] = await Promise.all([
    prisma.section.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: { class: { select: { name: true, order: true } } },
    }),
    prisma.section.count({ where }),
  ]);
  res.json(new ApiResponse(200, "Sections fetched", sections, buildPaginationMeta(total, page, limit)));
});

const createSection = asyncHandler(async (req, res) => {
  const { name, class: classId } = req.body;
  if (!name || !classId) throw new ApiError(400, "name, class required");

  const classDoc = await prisma.class.findFirst({ where: { id: classId, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!classDoc) throw new ApiError(404, "Class not found");

  // ✅ Pre-check for a friendly duplicate message
  const existingSection = await prisma.section.findFirst({
    where: { classId, name: name.trim() },
  });
  if (existingSection) {
    throw new ApiError(409, `Section "${name.trim()}" already exists in this class`);
  }

  const section = await prisma.section.create({
    data: {
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      classId,
      name: name.trim(), // admin's custom name, stored exactly as given
    },
  });
  res.status(201).json(new ApiResponse(201, "Section created", section));
});

const updateSection = asyncHandler(async (req, res) => {
  const existing = await prisma.section.findFirst({ where: { id: req.params.id, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!existing) throw new ApiError(404, "Section not found");

  const { name, isActive } = req.body;
  const section = await prisma.section.update({ where: { id: req.params.id }, data: { name, isActive } });
  res.json(new ApiResponse(200, "Section updated", section));
});

const deleteSection = asyncHandler(async (req, res) => {
  const students = await prisma.student.count({ where: { sectionId: req.params.id, schoolId: req.schoolId } });
  if (students > 0) throw new ApiError(400, "Cannot delete section with existing students");

  const existing = await prisma.section.findFirst({ where: { id: req.params.id, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!existing) throw new ApiError(404, "Section not found");

  await prisma.section.delete({ where: { id: req.params.id } });
  res.json(new ApiResponse(200, "Section deleted"));
});

const createClassWithSections = asyncHandler(async (req, res) => {
  const { name, order, sections = [] } = req.body;
  if (!name) throw new ApiError(400, "name required");

  const cleanName = name.trim();
  const cleanSections = sections
    .map((s) => (typeof s === "string" ? s.trim() : s?.name?.trim()))
    .filter(Boolean);

  const existingClass = await prisma.class.findFirst({
    where: { sessionId: req.sessionId, name: cleanName },
  });
  if (existingClass) {
    throw new ApiError(409, `Class "${cleanName}" already exists in this session`);
  }

  // Guard against duplicate section names within the submitted list itself
  const dupeCheck = new Set(cleanSections.map((s) => s.toLowerCase()));
  if (dupeCheck.size !== cleanSections.length) {
    throw new ApiError(400, "Duplicate section names in the list");
  }

  const result = await prisma.$transaction(async (tx) => {
    const cls = await tx.class.create({
      data: {
        schoolId: req.schoolId,
        sessionId: req.sessionId,
        name: cleanName,
        order: order !== undefined ? Number(order) : 0,
      },
    });

    let createdSections = [];
    if (cleanSections.length) {
      await tx.section.createMany({
        data: cleanSections.map((secName) => ({
          schoolId: req.schoolId,
          sessionId: req.sessionId,
          classId: cls.id,
          name: secName,
        })),
      });
      createdSections = await tx.section.findMany({ where: { classId: cls.id } });
    }

    return { ...cls, sections: createdSections };
  });

  res.status(201).json(new ApiResponse(201, "Class created with sections", result));
});

module.exports = {
  getClasses, createClass, updateClass, deleteClass,
  getSections, createSection, updateSection, deleteSection,createClassWithSections 
};
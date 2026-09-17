const fs = require("fs");
const Papa = require("papaparse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { prisma } = require("../config/db");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");

const getStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const where = { schoolId: req.schoolId, sessionId: req.sessionId, isActive: true };
  if (req.query.class) where.classId = req.query.class;
  if (req.query.section) where.sectionId = req.query.section;
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search, mode: "insensitive" } },
      { enrollmentNo: { startsWith: req.query.search, mode: "insensitive" } },
      { parentEmail: { contains: req.query.search, mode: "insensitive" } },
    ];
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where, skip, take: limit, orderBy: { enrollmentNo: "asc" },
      include: {
        class: { select: { name: true, order: true } },
        section: { select: { name: true } },
      },
    }),
    prisma.student.count({ where }),
  ]);

  res.json(new ApiResponse(200, "Students fetched", students, buildPaginationMeta(total, page, limit)));
});

const createStudent = asyncHandler(async (req, res) => {
  const { name, enrollmentNo, class: classId, section, parentName, parentEmail } = req.body;
  if (!name || !enrollmentNo || !classId || !section) {
    throw new ApiError(400, "name, enrollmentNo, class, section required");
  }

  // Section must actually belong to the given class (and this session)
  const sectionDoc = await prisma.section.findFirst({
    where: { id: section, classId, schoolId: req.schoolId, sessionId: req.sessionId },
  });
  if (!sectionDoc) throw new ApiError(404, "Section not found for the given class");

  const student = await prisma.student.create({
    data: {
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      name,
      enrollmentNo,
      classId,
      sectionId: section,
      parentName: parentName || "",
      parentEmail: parentEmail ? parentEmail.toLowerCase() : "",
    },
  });

  res.status(201).json(new ApiResponse(201, "Student created", student));
});

const updateStudent = asyncHandler(async (req, res) => {
  const existing = await prisma.student.findFirst({
    where: { id: req.params.id, schoolId: req.schoolId, sessionId: req.sessionId },
  });
  if (!existing) throw new ApiError(404, "Student not found");

  // Whitelist: only these fields may be changed after creation
  const { name, class: classId, section, parentName, parentEmail, specialNeeds } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (classId !== undefined) data.classId = classId;
  if (section !== undefined) data.sectionId = section;
  if (parentName !== undefined) data.parentName = parentName;
  if (parentEmail !== undefined) data.parentEmail = parentEmail.toLowerCase();
  if (specialNeeds !== undefined) data.specialNeeds = Boolean(specialNeeds);

  const student = await prisma.student.update({
    where: { id: req.params.id },
    data,
    include: {
      class: { select: { name: true, order: true } },
      section: { select: { name: true } },
    },
  });

  res.json(new ApiResponse(200, "Student updated", student));
});

const deleteStudent = asyncHandler(async (req, res) => {
  const existing = await prisma.student.findFirst({ where: { id: req.params.id, schoolId: req.schoolId, sessionId: req.sessionId } });
  if (!existing) throw new ApiError(404, "Student not found");

  await prisma.student.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json(new ApiResponse(200, "Student deactivated"));
});

const uploadCSV = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "CSV file required");

  const fileContent = fs.readFileSync(req.file.path, "utf-8");
  fs.unlinkSync(req.file.path);

  const { data, errors: parseErrors } = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  if (parseErrors.length > 0) throw new ApiError(400, "CSV parse error", parseErrors);
  if (!data.length) throw new ApiError(400, "CSV is empty");

  // className + sectionName identify the section by human-readable name,
  // since school admins define arbitrary section names (e.g. "Commerce - A").
  const required = ["name", "enrollmentNo", "className", "sectionName"];
  const missing = required.filter((f) => !Object.keys(data[0]).includes(f));
  if (missing.length) throw new ApiError(400, `Missing CSV columns: ${missing.join(", ")}`);

  // Resolve classes for this school + active session
  const classNames = [...new Set(data.map((r) => r.className?.trim()))];
  const classes = await prisma.class.findMany({
    where: { schoolId: req.schoolId, sessionId: req.sessionId, name: { in: classNames } },
    include: { sections: true },
  });

  const classMap = {};
  classes.forEach((c) => (classMap[c.name] = c));

  const rowErrors = [];
  const toInsert = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const classDoc = classMap[row.className?.trim()];

    if (!classDoc) {
      rowErrors.push({ row: i + 2, field: "className", message: `Class '${row.className}' not found` });
      continue;
    }

    const sectionDoc = classDoc.sections.find(
      (s) => s.name.toLowerCase() === row.sectionName?.trim().toLowerCase()
    );
    if (!sectionDoc) {
      rowErrors.push({ row: i + 2, field: "sectionName", message: `Section '${row.sectionName}' not found in class '${row.className}'` });
      continue;
    }

    if (!row.name || !row.enrollmentNo) {
      rowErrors.push({ row: i + 2, field: "required", message: "Missing required field" });
      continue;
    }

    toInsert.push({
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      name: row.name.trim(),
      enrollmentNo: row.enrollmentNo.trim(),
      classId: classDoc.id,
      sectionId: sectionDoc.id,
      parentName: row.parentName ? row.parentName.trim() : "",
      parentEmail: row.parentEmail ? row.parentEmail.trim().toLowerCase() : "",
    });
  }

  if (rowErrors.length > 0) throw new ApiError(400, "CSV validation failed", rowErrors);

  try {
    await prisma.student.createMany({ data: toInsert, skipDuplicates: true });
  } catch (err) {
    throw new ApiError(409, "Duplicate enrollment number in CSV");
  }

  await prisma.activityLog.create({
    data: {
      schoolId: req.schoolId,
      action: "STUDENT_CSV_UPLOAD",
      entity: "Student",
      description: `${toInsert.length} students imported via CSV`,
      metadata: { count: toInsert.length, sessionId: req.sessionId },
    },
  });

  res.json(new ApiResponse(200, `${toInsert.length} students imported successfully`, { imported: toInsert.length }));
});

const getCSVTemplate = asyncHandler(async (req, res) => {
  const csv = "name,enrollmentNo,className,sectionName,parentName,parentEmail\nRahul Sharma,SCH2026001,Class 9,Commerce - A,Suresh Sharma,suresh@example.com\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=students_template.csv");
  res.send(csv);
});

module.exports = { getStudents, createStudent, updateStudent, deleteStudent, uploadCSV, getCSVTemplate };

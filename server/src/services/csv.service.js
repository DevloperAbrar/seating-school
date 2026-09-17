const Papa = require("papaparse");
const fs = require("fs");

/**
 * Parse a CSV file from disk and return { data, errors }
 */
const parseCSVFile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  fs.unlinkSync(filePath); // clean up temp file

  const { data, errors } = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  return { data, errors };
};

/**
 * Validate that all required columns exist in CSV header row
 */
const validateColumns = (row, required) => {
  const keys = Object.keys(row || {});
  const missing = required.filter((c) => !keys.includes(c));
  return missing;
};

/**
 * Build a CSV string from an array of objects
 */
const buildCSV = (rows) => {
  if (!rows?.length) return "";
  return Papa.unparse(rows);
};

/**
 * Student CSV template columns with sample row.
 * className/sectionName are matched by name against the school's existing
 * Class/Section records for the active session (see student.controller.js
 * uploadCSV) — not by ID, since admins fill this out by hand.
 */
const STUDENT_CSV_TEMPLATE = buildCSV([
  {
    name: "Rahul Sharma",
    enrollmentNo: "SCH2026001",
    className: "Class 9",
    sectionName: "A",
    parentName: "Suresh Sharma",
    parentEmail: "suresh@example.com",
  },
  {
    name: "Priya Mehta",
    enrollmentNo: "SCH2026002",
    className: "Class 12",
    sectionName: "Commerce - A",
    parentName: "Anil Mehta",
    parentEmail: "anil@example.com",
  },
]);

module.exports = { parseCSVFile, validateColumns, buildCSV, STUDENT_CSV_TEMPLATE };

const express = require("express");
const { getDashboard } = require("../controllers/dashboard.controller");
const {
  getClasses, createClass, updateClass, deleteClass,
  getSections, createSection, updateSection, deleteSection,
  createClassWithSections,
} = require("../controllers/academic.controller");

const router = express.Router();

// Classes
router.get("/classes", getClasses);
router.post("/classes", createClass);
router.post("/classes-with-sections", createClassWithSections);
router.put("/classes/:id", updateClass);
router.delete("/classes/:id", deleteClass);

// Sections
router.get("/sections", getSections);
router.post("/sections", createSection);
router.put("/sections/:id", updateSection);
router.delete("/sections/:id", deleteSection);

// Dashboard router (separate)
const dashboardRouter = express.Router();
dashboardRouter.get("/", getDashboard);

module.exports = { router, dashboardRouter };

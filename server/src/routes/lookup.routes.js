const express = require("express");
const { studentLookup, facultyLookup } = require("../controllers/lookup.controller");

const router = express.Router();

// schoolCode is now required so two schools with the same
// enrollment number or email don't see each other's data.
router.get("/student/:schoolCode/:enrollmentNo", studentLookup);
router.get("/faculty/:schoolCode/:email", facultyLookup);

module.exports = router;
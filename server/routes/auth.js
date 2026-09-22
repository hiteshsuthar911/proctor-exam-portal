const express = require("express");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const { getIsConnected } = require("../config/db");

const router = express.Router();

// ─── POST /api/auth/admin ────────────────────────────────────────────────────
// Validates admin credentials from environment variables, returns JWT.
router.post("/admin", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const expectedUsername = process.env.ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (username !== expectedUsername || password !== expectedPassword) {
      return res.status(401).json({ success: false, message: "Invalid admin credentials" });
    }

    const token = jwt.sign(
      { role: "admin", username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ success: true, token, role: "admin", username });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// ─── POST /api/auth/student ──────────────────────────────────────────────────
// Validates student ID + PIN, returns JWT with student info.
router.post("/student", async (req, res) => {
  try {
    if (!getIsConnected()) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected. Please configure MONGODB_URI in .env or Render dashboard.",
      });
    }

    const { studentId, pin } = req.body;

    if (!studentId || !pin) {
      return res.status(400).json({ success: false, message: "Student ID and PIN are required" });
    }

    const student = await Student.findOne({ studentId: studentId.toUpperCase() });

    if (!student) {
      return res.status(401).json({ success: false, message: "Invalid Student ID or PIN" });
    }

    const pinMatch = await student.comparePin(String(pin));
    if (!pinMatch) {
      return res.status(401).json({ success: false, message: "Invalid Student ID or PIN" });
    }

    const token = jwt.sign(
      {
        role: "student",
        studentId: student.studentId,
        name: student.name,
        exam: student.exam,
        _id: student._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    res.json({
      success: true,
      token,
      role: "student",
      student: {
        studentId: student.studentId,
        name: student.name,
        exam: student.exam,
        status: student.status,
      },
    });
  } catch (err) {
    console.error("Student login error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

module.exports = router;

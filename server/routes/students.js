const express = require("express");
const Student = require("../models/Student");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const router = express.Router();

// All routes require admin JWT
router.use(authMiddleware, adminOnly);

// ─── GET /api/students ───────────────────────────────────────────────────────
// Return all students (PIN is excluded via toJSON)
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch students" });
  }
});

// ─── POST /api/students ──────────────────────────────────────────────────────
// Create a new student (PIN will be bcrypt-hashed by the model hook)
router.post("/", async (req, res) => {
  try {
    const { name, studentId, pin, exam } = req.body;

    if (!name || !studentId || !pin) {
      return res.status(400).json({ success: false, message: "Name, Student ID, and PIN are required" });
    }

    if (!/^\d{4,8}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: "PIN must be 4–8 digits" });
    }

    // Check duplicate
    const exists = await Student.findOne({ studentId: studentId.toUpperCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: `Student ID "${studentId.toUpperCase()}" already exists` });
    }

    const student = await Student.create({ name, studentId, pin: String(pin), exam: exam || "" });
    res.status(201).json({ success: true, student });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Student ID already exists" });
    }
    console.error("Create student error:", err);
    res.status(500).json({ success: false, message: "Failed to create student" });
  }
});

// ─── PUT /api/students/:id ───────────────────────────────────────────────────
// Update student (if pin changed, model hook will re-hash)
router.put("/:id", async (req, res) => {
  try {
    const { name, studentId, pin, exam, status } = req.body;
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Check duplicate studentId (excluding this doc)
    if (studentId && studentId.toUpperCase() !== student.studentId) {
      const exists = await Student.findOne({ studentId: studentId.toUpperCase() });
      if (exists) {
        return res.status(409).json({ success: false, message: `Student ID "${studentId.toUpperCase()}" already exists` });
      }
    }

    if (name)      student.name      = name;
    if (studentId) student.studentId = studentId.toUpperCase();
    if (pin)       student.pin       = String(pin); // pre-save hook will hash
    if (exam !== undefined) student.exam = exam;
    if (status)    student.status    = status;

    await student.save(); // triggers pre-save hash if pin was changed
    res.json({ success: true, student });
  } catch (err) {
    console.error("Update student error:", err);
    res.status(500).json({ success: false, message: "Failed to update student" });
  }
});

// ─── DELETE /api/students/:id ────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    res.json({ success: true, message: "Student removed" });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ success: false, message: "Failed to delete student" });
  }
});

module.exports = router;

const express = require("express");
const Submission = require("../models/Submission");
const Student = require("../models/Student");
const { authMiddleware, adminOnly, studentOnly } = require("../middleware/auth");

const router = express.Router();

// ─── GET /api/submissions ────────────────────────────────────────────────────
// Admin only: list all submissions (photo omitted for listing performance)
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const submissions = await Submission.find()
      .sort({ createdAt: -1 })
      .select("-snapshot"); // exclude large base64 from list

    res.json({ success: true, submissions });
  } catch (err) {
    console.error("Get submissions error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch submissions" });
  }
});

// ─── GET /api/submissions/:id ────────────────────────────────────────────────
// Admin only: get a single submission WITH the snapshot photo
router.get("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }
    res.json({ success: true, submission });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch submission" });
  }
});

// ─── POST /api/submissions ───────────────────────────────────────────────────
// Student only: save exam submission
router.post("/", authMiddleware, studentOnly, async (req, res) => {
  try {
    const {
      firstName, middleName, lastName,
      dob, gender, state, district, city,
      snapshot, duration, tabSwitches
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: "First name and last name are required" });
    }

    const studentId = req.user.studentId;

    // Prevent duplicate submissions from the same student
    const existing = await Submission.findOne({ studentId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted. Contact your invigilator."
      });
    }

    const submission = await Submission.create({
      studentId,
      candidateName: [firstName, middleName, lastName].filter(Boolean).join(" "),
      firstName, middleName, lastName,
      dob, gender, state, district, city,
      snapshot: snapshot || "",
      duration: duration || "00:00",
      tabSwitches: typeof tabSwitches === "number" ? tabSwitches : 0,
    });

    // Update student status to 'submitted'
    await Student.findOneAndUpdate({ studentId }, { status: "submitted" });

    res.status(201).json({ success: true, submissionId: submission._id });
  } catch (err) {
    console.error("Create submission error:", err);
    res.status(500).json({ success: false, message: "Failed to save submission" });
  }
});

// ─── DELETE /api/submissions ─────────────────────────────────────────────────
// Admin only: clear ALL submissions and reset student statuses
router.delete("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Submission.deleteMany({});
    await Student.updateMany({ status: "submitted" }, { status: "pending" });
    res.json({ success: true, message: "All submissions cleared" });
  } catch (err) {
    console.error("Clear submissions error:", err);
    res.status(500).json({ success: false, message: "Failed to clear submissions" });
  }
});

module.exports = router;

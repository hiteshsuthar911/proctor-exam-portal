/**
 * Proctor Exam Portal — Express Server
 * Serves the static frontend from /public and REST API from /api
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB, getIsConnected } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? false  // same-origin on Render (Express serves frontend)
    : "*",   // allow all origins in dev
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Increase body limit to handle base64 photo uploads (~1-2 MB)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ─── Serve static frontend ───────────────────────────────────────────────────
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// ─── DB Guard for database-dependent routes ─────────────────────────────────
const requireDB = (req, res, next) => {
  if (!getIsConnected()) {
    return res.status(503).json({
      success: false,
      message: "Database connection not available. Please verify MONGODB_URI in your .env or Render dashboard.",
    });
  }
  next();
};

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/students",    requireDB, require("./routes/students"));
app.use("/api/submissions", requireDB, require("./routes/submissions"));

// Health check endpoint (Render and uptime monitors use this)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: getIsConnected() ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 for unknown /api routes ────────────────────────────────────────────
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// ─── Fallback: serve index.html for all other routes ────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ─── Start server ────────────────────────────────────────────────────────────
async function start() {
  // Connect to DB asynchronously (doesn't block server from binding PORT)
  connectDB().catch(err => console.error("Initial DB connection failed:", err.message));

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Exam & Proctoring Portal is online!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🏛️ Candidate Form (90s UI): http://localhost:${PORT}/index.html`);
    console.log(`📊 Admin Panel:             http://localhost:${PORT}/admin.html`);
    console.log(`======================================================\n`);
  });
}

start();

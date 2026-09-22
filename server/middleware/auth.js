const jwt = require("jsonwebtoken");

/**
 * Middleware: Verify JWT token from Authorization: Bearer <token> header.
 * Attaches req.user = { role, id/studentId, ... }
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Session expired. Please login again." });
    }
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
  }
}

/**
 * Middleware: Require admin role.
 * Must be used AFTER authMiddleware.
 */
function adminOnly(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
}

/**
 * Middleware: Require student role.
 * Must be used AFTER authMiddleware.
 */
function studentOnly(req, res, next) {
  if (req.user && req.user.role === "student") return next();
  return res.status(403).json({ success: false, message: "Forbidden: Student access required" });
}

module.exports = { authMiddleware, adminOnly, studentOnly };

const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

/**
 * Authorization middleware.
 * Expects header: Authorization: Bearer <token>
 * Attaches req.user = user document
 */
module.exports = async function (req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "missing_token" });
    const token = auth.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.sub) return res.status(401).json({ error: "invalid_token" });

    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) return res.status(401).json({ error: "invalid_token" });

    req.user = user;
    next();
  } catch (err) {
    console.error("auth middleware error", err);
    return res.status(401).json({ error: "invalid_token" });
  }
};

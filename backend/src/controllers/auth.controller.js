const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const { ensureSystemSettingsForUser } = require("../services/systemSettings.service");
const generateToken = require("../utils/generateToken");

async function register(req, res) {
  try {
    const name = req.body.name?.trim() || "";
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "user_already_exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name || "",
      email: email.toLowerCase(),
      passwordHash,
    });

    // ✅ CREATE SYSTEM SETTINGS
    await ensureSystemSettingsForUser(user._id);

    const token = generateToken(user);

    res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "server_error" });
  }
}

async function login(req, res) {
  try {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ error: "email_and_password_required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    // ✅ ENSURE SETTINGS EXIST
    await ensureSystemSettingsForUser(user._id);

    const token = generateToken(user);

    res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "server_error" });
  }
}

async function me(req, res) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "unauthenticated" });
  }

  res.json({
    ok: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}

module.exports = { register, login, me };

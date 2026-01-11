import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// POST /auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, userType } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash,
      userType: userType || "investor"
    });

    // FIX: Generate token immediately so the user is auto-logged in
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // FIX: Return the token and userType so the frontend knows who just joined
    return res.status(201).json({ 
      message: "User created", 
      token, 
      userId: user._id, 
      userType: user.userType 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Signup failed" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30m" });

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({ token, userId: user._id, userType: user.userType });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// GET /auth/user/:id - Fetch minimal user profile
router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("userType");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ userType: user.userType });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;

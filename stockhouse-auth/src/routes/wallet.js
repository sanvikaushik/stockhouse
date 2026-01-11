import express from "express";
import User from "../models/User.js";
const router = express.Router();

// GET /wallet/balance/:userId
router.get("/balance/:userId", async (req, res) => {
  const user = await User.findById(req.params.userId);
  res.json({ balance: user.balance });
});

// POST /wallet/add-funds (For the "Fake Money" faucet)
router.post("/add-funds", async (req, res) => {
  const { userId, amount } = req.body;
  const user = await User.findByIdAndUpdate(
    userId, 
    { $inc: { balance: amount } }, 
    { new: true }
  );
  res.json({ message: "Funds added", newBalance: user.balance });
});

export default router;
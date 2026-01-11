import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/properties.js";
import walletRoutes from "./routes/wallet.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optimized CORS for Hackathon
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Routes
app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);
app.use("/wallet", walletRoutes);

app.get("/", (req, res) => {
  res.json({ message: "EquityArc API is running" });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`\n✅ API running on http://localhost:${port}`);
});

connectDB()
  .then(() => console.log('✅ Database connected'))
  .catch((err) => {
    console.error("❌ DB connect error:", err.message);
    process.exit(1);
  });
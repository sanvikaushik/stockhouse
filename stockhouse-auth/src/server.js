import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

app.get("/", (req, res) => res.send("StockHouse API is running"));
app.get("/health", (req, res) => res.json({ ok: true }));

await connectDB();

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🚀 running on http://localhost:${port}`));
connectDB(); 
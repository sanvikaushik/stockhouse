import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./db.js";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/properties.js";

dotenv.config();

const app = express();
<<<<<<< Updated upstream

// Enable CORS
app.use(cors({ origin: "*" }));
=======
app.use(cors());
>>>>>>> Stashed changes
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);

app.get("/", (req, res) => res.send("StockHouse API is running"));
app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;

app.listen(port, () => console.log(`running on http://localhost:${port}`));

connectDB().catch((err) => console.error("DB connect error:", err.message));

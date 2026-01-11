import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

import authRoutes from "./routes/auth.js";
import propertyRoutes from "./routes/properties.js";

import walletRoutes from "./routes/wallet.js"; // new wallet routes

dotenv.config();

const app = express();

// Enable CORS
app.use(cors({ origin: "*" }));
app.use(cors());

// ============================================================================
// Middleware
// ============================================================================

// JSON parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - Enable cross-origin requests from frontend
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// ============================================================================
// Routes
// ============================================================================

app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);
app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);
app.use("/wallet", walletRoutes);

app.get("/", (req, res) => {
  res.json({ 
    message: "StockHouse API is running",
    version: "1.0.0",
    endpoints: {
      auth: ["/auth/signup", "/auth/login"],
      properties: [
        "GET /properties (list all)",
        "GET /properties/:id (single property)",
        "POST /properties/purchase",
        "GET /properties/portfolio/:userId",
        "POST /properties/sync/:id",
        "POST /properties/calculate-dues/:propertyId",
        "POST /properties/transfer-shares",
        "GET /properties/validate-equity/:propertyId"
      ]
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  console.log(`\n✅ StockHouse API running on http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/`);
  console.log(`💚 Health Check: http://localhost:${port}/health`);
  console.log('\n');
});

// Database connection
connectDB()
  .then(() => console.log('✅ Database connected'))
  .catch((err) => {
    console.error("❌ DB connect error:", err.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


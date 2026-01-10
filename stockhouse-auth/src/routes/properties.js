import express from "express";
import Property from "../models/Property.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const props = await Property.find({ status: "active" }).limit(50).sort({ createdAt: -1 });
  res.json(props);
});

router.post("/ingest", async (req, res) => {
  const { rows, totalShares = 10000, perUserShareCap = 200 } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows must be a non-empty array" });
  }

  const results = [];

  for (const r of rows) {
    const externalPropertyId = String(r.PROPERTY_ID);
    const valuation = Number(r.ESTIMATED_VALUE || r.SOLD_PRICE || 0);
    if (!externalPropertyId || !r.STREET_ADDRESS || !r.CITY || !valuation) continue;

    const sharePrice = valuation / totalShares;

    await Property.updateOne(
      { externalPropertyId },
      {
        $setOnInsert: {
          externalPropertyId,
          address: r.STREET_ADDRESS,
          city: r.CITY,
          state: r.STATE,
          zip: r.ZIP,
          images: [],
          totalShares,
          availableShares: totalShares,
          perUserShareCap,
          status: "active"
        },
        $set: {
          valuation,
          sharePrice
        }
      },
      { upsert: true }
    );

    results.push(externalPropertyId);
  }

  res.json({ ingested: results.length });
});

export default router;

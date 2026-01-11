import express from "express";
import { exec } from "child_process";
import Property from "../models/Property.js";
import Holding from "../models/Holding.js";
import Router from "express";
import User from "../models/User.js";
const router = Router();

// GET /properties - List properties with optional pagination
router.get("/", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 0;
    const skip = Number(req.query.skip) || 0;
    const status = req.query.status;
    const filter = status ? { status } : {};

    const properties = await Property.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ properties, count: properties.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch properties", details: err.message });
  }
});

// POST /properties/purchase - Purchase shares of a property
router.post("/purchase", async (req, res) => {
  const { userId, propertyId, sharesToBuy, isResident } = req.body;

  try {
    const prop = await Property.findById(propertyId); //
    const user = await User.findById(userId); //

    if (!prop) return res.status(404).json({ error: "Property not found" });
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. Calculate Total Cost
    const totalCost = sharesToBuy * prop.sharePrice;

    // 2. WALLET CHECK: Does the peer have enough fake money?
    if (user.balance < totalCost) { //
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    // 3. Availability & Cap Logic
    if (prop.availableShares < sharesToBuy) {
      return res.status(400).json({ error: "Insufficient equity available" });
    }

    // 4. ATOMIC TRANSACTION: Deduct Money & Update Equity
    user.balance -= totalCost; //
    prop.availableShares -= sharesToBuy;
    
    await user.save(); // Save the new balance
    await prop.save(); // Save the new share pool

    // 5. Update Holding (P2P Ledger)
    await Holding.updateOne(
      { userId, propertyId },
      { $inc: { sharesOwned: sharesToBuy } },
      { upsert: true }
    );

    res.json({ 
      message: "Purchase successful", 
      newBalance: user.balance, // Return new balance to UI
      remainingPool: prop.availableShares
    });
  } catch (err) {
    res.status(500).json({ error: "Transaction failed", details: err.message });
  }
});

// GET /properties/portfolio/:userId
router.get("/portfolio/:userId", async (req, res) => {
  try {
    // 1. Fetch all holdings for the user and populate property details
    const holdings = await Holding.find({ userId: req.params.userId }).populate("propertyId");

    const portfolioData = holdings.map(h => {
      const prop = h.propertyId;
      
      // 2. Calculate current market value of shares
      // Current Value = (Current Valuation / Total Shares) * Shares Owned
      const currentValuation = prop.valuation; 
      const currentShareValue = (currentValuation / prop.totalShares) * h.sharesOwned;
      
      // 3. Calculate original cost based on the share price at time of ingestion
      const originalCost = prop.sharePrice * h.sharesOwned; 

      return {
        propertyId: prop.externalPropertyId,
        address: prop.address,
        sharesOwned: h.sharesOwned,
        equityPercentage: ((h.sharesOwned / prop.totalShares) * 100).toFixed(2),
        totalInvestment: originalCost,
        currentMarketValue: currentShareValue,
        unrealizedProfit: currentShareValue - originalCost,
        appreciation: (((currentShareValue - originalCost) / originalCost) * 100).toFixed(2) + "%"
      };
    });

    res.json({
      summary: {
        totalPortfolioValue: portfolioData.reduce((acc, curr) => acc + curr.currentMarketValue, 0),
        totalProfit: portfolioData.reduce((acc, curr) => acc + curr.unrealizedProfit, 0)
      },
      assets: portfolioData
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch portfolio data" });
  }
});

// POST /properties/sync/:propertyId
router.post("/sync/:id", async (req, res) => {
  try {
    const prop = await Property.findById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Execute the Python bridge script
    exec(`python3 src/logic/sync_oracle.py ${prop.externalPropertyId}`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error}`);
        return res.status(500).json({ error: "Oracle Sync Failed" });
      }
      
      // Fetch the updated property from Mongo to return the new value
      const updatedProp = await Property.findById(req.params.id);
      res.json({ 
        message: "Valuation synced with Snowflake", 
        newValuation: updatedProp.valuation,
        log: stdout 
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Handle share purchase
router.post("/buy", async (req, res) => {
  try {
    const { propertyId, userId, shareCount, sharePrice, totalCost, address } = req.body;

    // Validate input
    if (!propertyId || !userId || !shareCount || !sharePrice) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Find property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Check availability
    if (property.availableShares < shareCount) {
      return res.status(400).json({ error: `Only ${property.availableShares} shares available` });
    }

    // Check per-user cap
    const maxUserCap = property.perUserShareCap || 200;
    if (shareCount > maxUserCap) {
      return res.status(400).json({ error: `Maximum ${maxUserCap} shares per user` });
    }

    // Update property - reduce available shares
    property.availableShares -= shareCount;
    await property.save();

    // Create transaction record (optional - for audit trail)
    const transactionId = `txn_${Date.now()}`;

    // Update or insert user's investment record
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has an investment for this property
    const existing = user.investments.find(inv => String(inv.propertyId) === String(property._id));

    if (existing) {
      // compute new totals
      const newShareCount = existing.shareCount + Number(shareCount);
      const newTotalCost = (existing.totalCost || 0) + Number(totalCost);
      const newSharePrice = newTotalCost / newShareCount;
      const ownershipPercent = (newShareCount / (property.totalShares || 10000)) * 100;

      // update the investment subdocument
      await User.updateOne(
        { _id: userId, 'investments.propertyId': property._id },
        {
          $set: {
            'investments.$.shareCount': newShareCount,
            'investments.$.totalCost': newTotalCost,
            'investments.$.sharePrice': newSharePrice,
            'investments.$.ownershipPercent': ownershipPercent,
            'investments.$.purchaseDate': new Date(),
            'investments.$.transactionId': transactionId
          }
        }
      );
    } else {
      const ownershipPercent = (Number(shareCount) / (property.totalShares || 10000)) * 100;
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            investments: {
              propertyId: property._id,
              shareCount: Number(shareCount),
              sharePrice: Number(sharePrice),
              totalCost: Number(totalCost),
              purchaseDate: new Date(),
              transactionId,
              ownershipPercent
            }
          }
        }
      );
    }

    // Return updated user investment to frontend
    const updatedUser = await User.findById(userId).select('investments');
    const updatedInvestment = updatedUser.investments.find(inv => String(inv.propertyId) === String(property._id));

    res.json({
      success: true,
      transactionId,
      message: `Successfully purchased ${shareCount} shares`,
      updatedProperty: {
        id: property._id,
        availableShares: property.availableShares
      },
      updatedInvestment
    });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ error: "Purchase failed: " + error.message });
  }
});

router.delete("/clear", async (req, res) => {
  try {
    // This deletes all documents in the Property collection
    const result = await Property.deleteMany({});
    
    console.log(`Database wiped: ${result.deleted_count} properties removed.`);
    
    res.json({ 
      success: true, 
      message: "All properties cleared successfully",
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("Clear error:", error);
    res.status(500).json({ error: "Failed to clear properties: " + error.message });
  }
});

// GET /properties/:id - Fetch a single property
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch property", details: err.message });
  }
});

// GET /properties/stats/active-investors - Count distinct users who hold any shares
router.get('/stats/active-investors', async (req, res) => {
  try {
    const { propertyIds } = req.query; // optional comma-separated ids
    if (propertyIds) {
      const ids = String(propertyIds).split(',').map(id => id.trim()).filter(Boolean);
      // find distinct users holding any of these properties
      const distinctUsers = await Holding.distinct('userId', { propertyId: { $in: ids } });
      return res.json({ count: distinctUsers.length });
    }

    const distinctUsers = await Holding.distinct('userId');
    res.json({ count: distinctUsers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute active investors', details: err.message });
  }
});

export default router;

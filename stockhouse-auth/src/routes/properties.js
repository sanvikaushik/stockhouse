import express from "express";
import { exec } from "child_process";
import Property from "../models/Property.js";
import Holding from "../models/Holding.js";
import Router from "express";
import User from "../models/User.js";

const router = Router();

<<<<<<< Updated upstream
// GET /properties - List available properties
router.get("/", async (req, res) => {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 50);

  try {
    const properties = await Property.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ count: properties.length, properties });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

=======
// ============================================================================
// GET /properties - List all available properties (CRITICAL FIX)
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const properties = await Property.find({ status: { $ne: "fully_allocated" } })
      .limit(50)
      .sort({ createdAt: -1 });
    
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch properties", details: err.message });
  }
});

// ============================================================================
// GET /properties/:id - Get single property details
// ============================================================================
router.get("/:id", async (req, res) => {
  try {
    const prop = await Property.findById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });
    
    res.json(prop);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch property", details: err.message });
  }
});

// ============================================================================
>>>>>>> Stashed changes
// POST /properties/purchase - Purchase shares of a property
// ============================================================================
router.post("/purchase", async (req, res) => {
  const { userId, propertyId, sharesToBuy, isResident } = req.body;

  try {
    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // 1. Availability Check
    if (prop.availableShares < sharesToBuy) {
      return res.status(400).json({ error: "Insufficient community equity available" });
    }

    // 2. Conditional Cap Logic
    // Residents can buy up to 100%, Investors are capped at perUserShareCap
    if (!isResident && sharesToBuy > prop.perUserShareCap) {
      return res.status(400).json({ error: "Investor purchase exceeds per-user cap" });
    }

    // 3. Update Global Property State
    prop.availableShares -= sharesToBuy;
    if (prop.availableShares === 0) prop.status = "fully_allocated";
    await prop.save();

    // 4. Update Holding
    await Holding.updateOne(
      { userId, propertyId },
      { $inc: { sharesOwned: sharesToBuy } },
      { upsert: true }
    );

    res.json({ 
      message: "Purchase successful", 
      remainingPool: prop.availableShares,
      sharesOwned: sharesToBuy
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

// ============================================================================
// POST /properties/sync/:id - Sync property valuation from Snowflake
// ============================================================================
router.post("/sync/:id", async (req, res) => {
  try {
    const prop = await Property.findById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Execute the Python bridge script with absolute path handling
    const pythonScript = `${process.cwd()}/src/logic/sync_oracle.py`;
    exec(`python3 "${pythonScript}" ${prop.externalPropertyId}`, 
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, 
      async (error, stdout, stderr) => {
        if (error) {
          console.error(`Python Exec error:`, error);
          console.error(`stderr:`, stderr);
          return res.status(500).json({ 
            error: "Oracle Sync Failed", 
            details: stderr || error.message 
          });
        }
        
        try {
          // Parse Python output (should be JSON)
          const result = JSON.parse(stdout);
          
          // Update property with new valuation
          prop.valuation = result.newValuation;
          await prop.save();
          
          // Fetch the updated property
          const updatedProp = await Property.findById(req.params.id);
          res.json({ 
            message: "Valuation synced with Snowflake", 
            oldValuation: result.oldValuation,
            newValuation: updatedProp.valuation,
            appreciation: result.appreciation
          });
        } catch (parseErr) {
          res.status(500).json({ 
            error: "Failed to parse Python output", 
            details: stdout 
          });
        }
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Sync failed", details: err.message });
  }
});

// ============================================================================
// POST /properties/calculate-dues/:propertyId - Calculate monthly dues (EQUITY)
// ============================================================================
router.post("/calculate-dues/:propertyId", async (req, res) => {
  try {
    const { occupantId, investorShares } = req.body;
    
    const prop = await Property.findById(req.params.propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Calculate proportional dues based on equity
    // Formula: Individual Payment = Total Mortgage × (Individual Equity / 100)
    const totalMonthlyMortgage = prop.valuation * 0.005; // 0.5% of valuation
    
    const dues = {
      occupant: {
        id: occupantId,
        equity: 51,
        monthlyPayment: (totalMonthlyMortgage * 0.51).toFixed(2)
      },
      investors: investorShares.map(share => ({
        id: share.investorId,
        equity: share.equityPercentage,
        monthlyPayment: (totalMonthlyMortgage * (share.equityPercentage / 100)).toFixed(2)
      })),
      total: totalMonthlyMortgage.toFixed(2)
    };

    // Validate: sum should equal total
    const calculatedSum = parseFloat(dues.occupant.monthlyPayment) +
      dues.investors.reduce((sum, inv) => sum + parseFloat(inv.monthlyPayment), 0);
    
    if (Math.abs(calculatedSum - parseFloat(dues.total)) > 0.01) {
      return res.status(400).json({ 
        error: "Equity calculation validation failed",
        details: `Sum ${calculatedSum} != Total ${dues.total}`
      });
    }

    res.json(dues);
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate dues", details: err.message });
  }
});

// ============================================================================
// POST /properties/transfer-shares - Transfer equity between investors
// ============================================================================
router.post("/transfer-shares", async (req, res) => {
  try {
    const { propertyId, fromUserId, toUserId, sharesAmount, transactionPrice } = req.body;

    if (!propertyId || !fromUserId || !toUserId || !sharesAmount || !transactionPrice) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Get seller's holding
    const sellerHolding = await Holding.findOne({ userId: fromUserId, propertyId });
    if (!sellerHolding || sellerHolding.sharesOwned < sharesAmount) {
      return res.status(400).json({ error: "Seller has insufficient shares" });
    }

    // Execute transfer
    await Holding.updateOne(
      { userId: fromUserId, propertyId },
      { $inc: { sharesOwned: -sharesAmount } }
    );

    await Holding.updateOne(
      { userId: toUserId, propertyId },
      { $inc: { sharesOwned: sharesAmount } },
      { upsert: true }
    );

    res.json({
      message: "Share transfer successful",
      transaction: {
        from: fromUserId,
        to: toUserId,
        sharesTransferred: sharesAmount,
        pricePerShare: (transactionPrice / sharesAmount).toFixed(2),
        totalPrice: transactionPrice,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Transfer failed", details: err.message });
  }
});

// ============================================================================
// GET /properties/validate-equity/:propertyId - Check 51% rule compliance
// ============================================================================
router.get("/validate-equity/:propertyId", async (req, res) => {
  try {
    const prop = await Property.findById(req.params.propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const holdings = await Holding.find({ propertyId: req.params.propertyId });
    
    // Calculate equity percentages
    const totalShares = holdings.reduce((sum, h) => sum + h.sharesOwned, 0);
    
    const equityBreakdown = holdings.map(h => ({
      userId: h.userId,
      sharesOwned: h.sharesOwned,
      equityPercentage: ((h.sharesOwned / totalShares) * 100).toFixed(2)
    })).sort((a, b) => b.equityPercentage - a.equityPercentage);

    // Check 51% rule (largest holder should have >= 51%)
    const isValid = equityBreakdown.length > 0 && parseFloat(equityBreakdown[0].equityPercentage) >= 51;

    res.json({
      propertyId: req.params.propertyId,
      totalInvestors: holdings.length,
      totalSharesIssued: totalShares,
      equityBreakdown,
      is51RuleCompliant: isValid,
      status: isValid ? "✅ VALID" : "❌ VIOLATION - Primary occupant < 51%"
    });
  } catch (err) {
    res.status(500).json({ error: "Validation failed", details: err.message });
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

export default router;

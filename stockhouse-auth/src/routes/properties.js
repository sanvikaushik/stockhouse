import { exec } from "child_process";

router.post("/purchase", async (req, res) => {
  const { userId, propertyId, sharesToBuy, isResident } = req.body;

  try {
    const prop = await Property.findById(propertyId);
    
    // 1. Availability Check
    if (prop.availableShares < sharesToBuy) {
      return res.status(400).json({ error: "Not enough shares available" });
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
      newEquityTotal: sharesToBuy,
      isResidentMajority: isResident 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /properties/purchase
router.post("/purchase", async (req, res) => {
  const { userId, propertyId, sharesToBuy, isResident } = req.body;

  try {
    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Ensure investors don't eat into the resident's 51% minimum stake
    // availableShares should represent the 49% community pool
    if (prop.availableShares < sharesToBuy) {
      return res.status(400).json({ error: "Insufficient community equity available" });
    }

    // Process purchase
    prop.availableShares -= sharesToBuy;
    if (prop.availableShares === 0) prop.status = "fully_allocated";
    await prop.save();

    // Record the holding
    await Holding.updateOne(
      { userId, propertyId },
      { $inc: { sharesOwned: sharesToBuy } },
      { upsert: true }
    );

    res.json({ message: "Purchase successful", remainingPool: prop.availableShares });
  } catch (err) {
    res.status(500).json({ error: "Transaction failed" });
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
router.post("/sync/:propertyId", async (req, res) => {
  try {
    const prop = await Property.findById(req.params.propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Execute the Python 'Oracle' script to fetch latest Snowflake data
    // In a hackathon, we pass the externalPropertyId to a script that updates the DB
    exec(`python3 src/logic/sync_oracle.py ${prop.externalPropertyId}`, async (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: "Oracle Sync Failed" });
      
      // Refresh the property data from the updated DB
      const updatedProp = await Property.findById(req.params.propertyId);
      res.json({ message: "Market value updated via Snowflake", newValuation: updatedProp.valuation });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
from uuid import uuid4
from datetime import datetime
from typing import Dict, Optional

class PropertyAgreement:
    def __init__(
        self, 
        address: str, 
        total_value: float, 
        monthly_mortgage: float,
        occupant_id: str,
        initial_occupant_equity: float = 51.0
    ):
        # Unique Identifier for the Property
        self.property_id = f"PROP-{uuid4().hex[:8].upper()}"
        self.address = address
        self.total_value = total_value
        self.monthly_mortgage = monthly_mortgage
        
        # Ownership State
        self.occupant_id = occupant_id
        self.occupant_equity = initial_occupant_equity
        
        # Investor State: { "user_id": equity_percentage }
        self.investors: Dict[str, float] = {}
        
        # Hardcoded Constraints (The "Legal Guardrails")
        self.MIN_OCCUPANT_EQUITY = 51.0
        self.MAX_INVESTORS = 10
        
        # Initial Validation
        self._validate_state()

    def _validate_state(self):
        """Internal safety check to ensure the 51% rule and 100% total are met."""
        total_investor_equity = sum(self.investors.values())
        total_equity = self.occupant_equity + total_investor_equity

        if self.occupant_equity < self.MIN_OCCUPANT_EQUITY:
            raise ValueError(f"CRITICAL: Occupant equity ({self.occupant_equity}%) below 51% limit!")
        
        if total_equity > 100.001: # Allowing for tiny float rounding
            raise ValueError(f"CRITICAL: Total equity ({total_equity}%) exceeds 100%!")
            
        if len(self.investors) > self.MAX_INVESTORS:
            raise ValueError(f"CRITICAL: Maximum of {self.MAX_INVESTORS} investors reached.")

    def update_equity(self, buyer_id: str, seller_id: str, amount: float):
        """
        The master method for any equity change. 
        Covers Buy-Backs, Secondary Sales, and New Investments.
        """
        # 1. Deduct from Seller
        if seller_id == self.occupant_id:
            if (self.occupant_equity - amount) < self.MIN_OCCUPANT_EQUITY:
                raise PermissionError("Action Denied: Occupant cannot drop below 51% ownership.")
            self.occupant_equity -= amount
        elif seller_id in self.investors:
            if self.investors[seller_id] < amount:
                raise ValueError("Action Denied: Seller does not have enough equity.")
            self.investors[seller_id] -= amount
            if self.investors[seller_id] <= 0:
                del self.investors[seller_id]
        else:
            raise KeyError("Seller not found in this property agreement.")

        # 2. Add to Buyer
        if buyer_id == self.occupant_id:
            self.occupant_equity += amount
        else:
            self.investors[buyer_id] = self.investors.get(buyer_id, 0) + amount

        # 3. Final Integrity Check
        self._validate_state()
        return True

    def get_property_status(self):
        """Returns a snapshot for the Frontend UI."""
        return {
            "id": self.property_id,
            "address": self.address,
            "occupant_equity": f"{self.occupant_equity}%",
            "investor_count": len(self.investors),
            "available_equity": 100 - (self.occupant_equity + sum(self.investors.values()))
        }
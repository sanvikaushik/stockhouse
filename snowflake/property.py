import snowflake.connector
import pandas as pd
from snowflake.credentials import load_credentials #

"""
Sets up a property with:

Occupant equity: Hardcoded at 51% we want the occupant to have majority stake
Investors: Tracks community investor equity shares
Last sync: Tracks when property valuation was last updated
The Oracle Method - sync_valuation()
    - Re-queries Snowflake for the property's latest market value
    - Detects price movement: change = new_value - self.total_value
    - Auto-adjusts monthly mortgage based on new valuation: monthly_mortgage = total_value × 0.005

"""

class PropertyAgreement:
    def __init__(self, property_id, address, total_value, monthly_mortgage, occupant_id):
        self.property_id = property_id  # This must match Snowflake's PROPERTY_ID 
        self.address = address
        
        # ORIGINAL PURCHASE VALUES (FIXED - Never changes)
        self.original_purchase_value = total_value
        self.original_monthly_mortgage = monthly_mortgage
        self.original_down_payment = total_value * 0.20  # Assume 20% down payment
        
        # CURRENT MARKET VALUE (DYNAMIC - Updates with property appreciation)
        self.current_market_value = total_value
        
        self.occupant_id = occupant_id
        self.occupant_equity = 51.0
        self.investors = {}
        self.last_sync = None

    def sync_valuation(self):
        """
        Tracks property market value appreciation WITHOUT changing mortgage obligations.
        
        The mortgage is FIXED at original purchase valuation.
        Market value appreciation creates profit opportunities for share sales.
        
        Formula for share value:
        Share Profit Potential = (Current Market Value - Original Value) × (Investor's Equity %)
        """
        print(f" Syncing market valuation for Property {self.property_id}...")
        
        # 1. Connect using your existing credentials logic
        creds = load_credentials()
        conn = snowflake.connector.connect(**creds)
        
        # 2. Query for the specific property from the HousingWire dataset 
        query = f"""
        SELECT ESTIMATED_VALUE
        FROM SECURE_SAMPLE_US_NATIONAL_SOLD
        WHERE PROPERTY_ID = '{self.property_id}'
        AND ESTIMATED_VALUE IS NOT NULL
        LIMIT 1
        """
        
        try:
            df = pd.read_sql(query, conn)
            if not df.empty:
                new_market_value = float(df['ESTIMATED_VALUE'].iloc[0])
                old_market_value = self.current_market_value
                
                # 3. Track appreciation
                appreciation = new_market_value - old_market_value
                appreciation_percent = (appreciation / self.original_purchase_value) * 100
                
                self.current_market_value = new_market_value
                self.last_sync = pd.Timestamp.now()
                
                print(f" Market Sync Complete.")
                print(f"   Original Purchase Value: ${self.original_purchase_value:,.2f}")
                print(f"   Current Market Value: ${self.current_market_value:,.2f}")
                print(f"   Total Appreciation: ${appreciation:,.2f} ({appreciation_percent:.2f}%)")
                print(f"   Fixed Monthly Mortgage: ${self.original_monthly_mortgage:,.2f} (UNCHANGED)")
            else:
                print(" Sync Warning: Property ID not found in Snowflake.")
        finally:
            conn.close()

    def calculate_monthly_dues(self):
        """
        Calculates FIXED monthly mortgage payments based on ORIGINAL purchase valuation.
        
        Payments NEVER change, regardless of property appreciation.
        Each stakeholder pays proportional to their equity share of the ORIGINAL mortgage.
        """
        dues = {self.occupant_id: (self.occupant_equity / 100) * self.original_monthly_mortgage}
        for inv_id, equity in self.investors.items():
            dues[inv_id] = (equity / 100) * self.original_monthly_mortgage
        return dues
    
    def calculate_share_value(self, investor_id):
        """
        Calculates the current market value of an investor's shares.
        
        This enables profitable share sales when property appreciates.
        
        Formula:
        Current Share Value = (Current Market Value / Original Purchase Value) × Original Investment
        
        Example:
        - Original: $500K, Investor owns 25% = $125K share value
        - After appreciation to $600K:
          - Original mortgage stays $2,500/month
          - Investor's share now worth: $600K × 0.25 = $150K
          - Investor made $25K profit on their share!
        """
        if investor_id not in self.investors:
            return None
        
        investor_equity = self.investors[investor_id]
        original_share_value = self.original_purchase_value * (investor_equity / 100)
        current_share_value = self.current_market_value * (investor_equity / 100)
        profit = current_share_value - original_share_value
        
        return {
            "investor_id": investor_id,
            "equity_percentage": investor_equity,
            "original_value": original_share_value,
            "current_value": current_share_value,
            "unrealized_profit": profit,
            "profit_percentage": (profit / original_share_value * 100) if original_share_value > 0 else 0
        }

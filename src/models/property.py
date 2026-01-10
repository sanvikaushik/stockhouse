import snowflake.connector
import pandas as pd
from snowflake.credentials import load_credentials #

class PropertyAgreement:
    def __init__(self, property_id, address, total_value, monthly_mortgage, occupant_id):
        self.property_id = property_id  # This must match Snowflake's PROPERTY_ID 
        self.address = address
        self.total_value = total_value
        self.monthly_mortgage = monthly_mortgage
        self.occupant_id = occupant_id
        self.occupant_equity = 51.0
        self.investors = {}
        self.last_sync = None

    def sync_valuation(self):
        """
        The Oracle Method: Re-queries Snowflake to update the property's 
        market value and adjusts dues accordingly. ***re evaluetes the worht of the asset***
        """
        print(f" Syncing valuation for Property {self.property_id}...")
        
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
                new_value = float(df['ESTIMATED_VALUE'].iloc[0])
                
                # 3. Founder Impact: Identify price movement
                change = new_value - self.total_value
                self.total_value = new_value
                
                # 4. Update secondary mortgage dues based on new valuation
                # (Example: Adjusting dues by 0.5% of the new value)
                self.monthly_mortgage = self.total_value * 0.005
                self.last_sync = pd.Timestamp.now()
                
                print(f" Sync Complete. New Value: ${self.total_value:,.2f} (Δ: ${change:,.2f})")
            else:
                print(" Sync Warning: Property ID not found in Snowflake.")
        finally:
            conn.close()

    def calculate_monthly_dues(self):
        """Calculates payments based on the LATEST synced valuation."""
        dues = {self.occupant_id: (self.occupant_equity / 100) * self.monthly_mortgage}
        for inv_id, equity in self.investors.items():
            dues[inv_id] = (equity / 100) * self.monthly_mortgage
        return dues

import snowflake.connector
import pandas as pd
from snowflake.credentials import load_credentials
from snowflake.property import PropertyAgreement

"""
What It Does:
Connects to Snowflake - Uses credentials to establish a secure database connection

Fetches Property Data - Queries the SECURE_SAMPLE_US_NATIONAL_SOLD table for a specific property by ID...Snowflake's real estate dataset with property valuations

Calculates Monthly Mortgage - Uses a simple formula: estimated_mortgage = property_value × 0.005 (0.5% of value)
    - SHOULD WE CHANGE HOW WE CALCULATE THE MORTGAGE??

Instantiates PropertyAgreement - Creates a property object using your equity engine by passing: Property address, Total property value, Monthly mortgage, Primary occupant ID

Error Handling - Returns None if property not found, closes connection safely
"""

def fetch_property_from_snowflake(target_property_id: str, occupant_id: str):

    creds = load_credentials()
    conn = snowflake.connector.connect(**creds)
    
    query = f"""
    SELECT PROPERTY_ID, ESTIMATED_VALUE
    FROM SECURE_SAMPLE_US_NATIONAL_SOLD
    WHERE PROPERTY_ID = '{target_property_id}'
    LIMIT 1
    """
    
    try:
        df = pd.read_sql(query, conn)
        
        if df.empty:
            return None
            
        # Mapping Snowflake fields to our Logic Engine
        # Based on your output_file.csv
        record = df.iloc[0]
        
        # calculate monthly mortgage
        estimated_mortgage = record['ESTIMATED_VALUE'] * 0.005 
        
        # Instantiate our 'Step 1' Core Logic
        property_obj = PropertyAgreement(
            address=f"Property ID: {record['PROPERTY_ID']}", # We can join address table later
            total_value=record['ESTIMATED_VALUE'],
            monthly_mortgage=estimated_mortgage,
            occupant_id=occupant_id
        )
        
        return property_obj

    finally:
        conn.close()
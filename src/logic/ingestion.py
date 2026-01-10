import snowflake.connector
import pandas as pd
from snowflake.credentials import load_credentials
from models.property import PropertyAgreement

def fetch_property_from_snowflake(target_property_id: str, occupant_id: str):
    """
    Connects to Snowflake, retrieves specific property data, and returns an initialized 
    PropertyAgreement.
    """
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
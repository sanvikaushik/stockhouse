
import sys
import snowflake.connector
import pandas as pd
from pymongo import MongoClient
from credentials import load_credentials

def sync_property_valuation(property_id):
    # 1. Load Snowflake Credentials & Connect
    creds = load_credentials()
    conn = snowflake.connector.connect(**creds)
    
    # 2. Query Snowflake for the latest ESTIMATED_VALUE
    query = f"""
    SELECT ESTIMATED_VALUE
    FROM SECURE_SAMPLE_US_NATIONAL_SOLD
    WHERE PROPERTY_ID = '{property_id}'
    LIMIT 1
    """
    
    try:
        df = pd.read_sql(query, conn)
        if df.empty:
            print(f"Error: Property {property_id} not found in Snowflake.")
            return

        new_valuation = float(df.iloc[0]['ESTIMATED_VALUE'])

        # 3. Update MongoDB (Using your DB connection string)
        # Replace 'your_mongodb_uri' with your actual connection string
        client = MongoClient('your_mongodb_uri')
        db = client['stockhouse'] # Your database name
        
        result = db.properties.update_one(
            {"externalPropertyId": str(property_id)},
            {"$set": {"valuation": new_valuation}}
        )

        if result.modified_count > 0:
            print(f"SUCCESS: Property {property_id} updated to ${new_valuation:,.2f}")
        else:
            print(f"INFO: Property {property_id} is already up to date.")

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        sync_property_valuation(sys.argv[1])
    else:
        print("Usage: python3 sync_oracle.py <PROPERTY_ID>")
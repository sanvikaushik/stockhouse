# import snowflake.connector
import snowflake.connector
import pandas as pd
import requests
import json
from credentials import load_credentials

print(snowflake.connector.__version__)

creds = load_credentials()
conn = snowflake.connector.connect(
    account=creds['account'],
    user=creds['user'],
    password=creds['password'],
    role=creds['role'],
    warehouse=creds['warehouse'],
    database=creds['database'],
    schema=creds['schema'],
)

cur = conn.cursor()

query = """
SELECT PROPERTY_ID, ESTIMATED_VALUE, STREET_ADDRESS, CITY, STATE, ZIP
FROM SECURE_SAMPLE_US_NATIONAL_SOLD
WHERE ESTIMATED_VALUE IS NOT NULL
  AND STREET_ADDRESS IS NOT NULL
  AND CITY IS NOT NULL
LIMIT 1000
"""

df = pd.read_sql(query, conn)

print(df.head())
print(df.info())

# Stock price = property estimated value (users buy fractional shares)
# e.g., ESTIMATED_VALUE=$500k means stock_price=$500k per full share
# User can buy 0.1 shares = $50k ownership, or 0.01 shares = $5k ownership
df['stock_price'] = df['ESTIMATED_VALUE'] / 10000

print(df[['PROPERTY_ID', 'ESTIMATED_VALUE', 'stock_price']].head())
print(f"\nExample: Buy 0.1 shares of first property costs ${df.iloc[0]['stock_price'] * 0.1:,.2f}")

# ingest endpoint
ingest_url = 'http://localhost:3001/properties/ingest'

# convert dataframe to list of dicts for JSON serialization
rows = df.to_dict(orient='records')

# truncate to at most 100 rows to avoid large payloads / 413 errors
rows = rows[:100]

# prepare payload (users decide quantity at listed stock_price)
payload = {'rows': rows}

print(f"\nIngest payload preview (first row): {json.dumps(rows[0], indent=2)}")
print(f"Total rows to ingest: {len(rows)}")

# POST to ingest endpoint
try:
    response = requests.post(ingest_url, json=payload)
    print(f"\nIngest response status: {response.status_code}")
    print(f"Ingest response: {response.text}")
except Exception as e:
    print(f"Ingest error: {e}")

conn.close()




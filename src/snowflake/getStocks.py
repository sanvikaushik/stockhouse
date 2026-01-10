# import snowflake.connector
import snowflake.connector
import pandas as pd
from snowflake.credentials import load_credentials

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
SELECT PROPERTY_ID, ESTIMATED_VALUE
FROM SECURE_SAMPLE_US_NATIONAL_SOLD
WHERE ESTIMATED_VALUE IS NOT NULL
LIMIT 1000
"""

df = pd.read_sql(query, conn)

print(df.head())
print(df.info())


df['fundamental_price_per_share'] = df['ESTIMATED_VALUE'] / shares_per_home

print(df[['PROPERTY_ID', 'ESTIMATED_VALUE', 'fundamental_price_per_share']].head())
conn.close()

#we will tkae a user input from the shares of the home
shares_per_home = 100  # Example fixed value, can be replaced with user input

# create the stock price with some randomness 
df['stock_price'] = df['fundamental_price_per_share'] / shares_per_home #add some randomness?

df.to_csv('output_file.csv', index=False)




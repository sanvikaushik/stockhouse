# import snowflake.connector
import snowflake.connector
import pandas as pd
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
SELECT PROPERTY_ID, ESTIMATED_VALUE
FROM SECURE_SAMPLE_US_NATIONAL_SOLD
WHERE ESTIMATED_VALUE IS NOT NULL
LIMIT 1000
"""

df = pd.read_sql(query, conn)

print(df.head())
print(df.info())


#add user imput here from the ui 
shares_per_home = 100 #placeholder for user input

df['stock_price'] = df['ESTIMATED_VALUE'] / shares_per_home #add some randomness?

print(df[['PROPERTY_ID', 'ESTIMATED_VALUE', 'stock_price']].head())
conn.close()

df.to_csv('output_file.csv', index=False)




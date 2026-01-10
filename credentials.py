"""Load Snowflake credentials from `credentials.txt` (key=value) or environment.

Usage:
    from credentials import load_credentials
    creds = load_credentials()
    conn = snowflake.connector.connect(**creds)
"""
import os


def load_credentials(path='credentials.txt'):
    """Return a dict with keys expected by `snowflake.connector.connect`.

    Order of precedence:
      1. `credentials.txt` entries (key=value)
      2. Environment variables (SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PWD, ...)
      3. Hard-coded sensible defaults (role, warehouse, database, schema)
    """
    creds = {}
    if os.path.isfile(path):
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    creds[k.strip()] = v.strip()

    def get(key, env_key=None, default=None):
        return creds.get(key) or os.getenv(env_key or key.upper()) or default

    return {
        'account': get('account', 'SNOWFLAKE_ACCOUNT'),
        'user': get('user', 'SNOWFLAKE_USER'),
        'password': get('password', 'SNOWFLAKE_PWD'),
        'role': get('role', 'SNOWFLAKE_ROLE', 'ACCOUNTADMIN'),
        'warehouse': get('warehouse', 'SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
        'database': get('database', 'SNOWFLAKE_DATABASE', 'HOUSEWARE_DB'),
        'schema': get('schema', 'SNOWFLAKE_SCHEMA', 'PUBLIC'),
    }


if __name__ == '__main__':
    print('Credentials preview (password hidden):')
    c = load_credentials()
    masked = c.copy()
    if masked.get('password'):
        masked['password'] = '***'
    print(masked)

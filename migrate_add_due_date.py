"""
Database migration script to add due_date column to patients table.
This adds a column for tracking the expected delivery date of pregnant patients.
"""

import psycopg2
from psycopg2 import sql, Error


def add_due_date_column():
    """Add due_date column to patients table if it doesn't exist"""
    
    # Database connection parameters
    db_config = {
        'host': 'localhost',
        'user': 'bloomcare_user',
        'password': 'bloomcare_pass',
        'database': 'bloomcare_db',
        'port': 5432
    }

    try:
        # Connect to the database
        connection = psycopg2.connect(**db_config)
        cursor = connection.cursor()

        # Add due_date column to patients table
        add_column_query = sql.SQL("""
            ALTER TABLE {schema}.patients
            ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;
        """).format(
            schema=sql.Identifier('bloomcare')
        )

        cursor.execute(add_column_query)
        connection.commit()
        print("✓ Successfully added due_date column to patients table")

        cursor.close()
        connection.close()

    except Error as e:
        print(f"✗ Error during migration: {e}")
        raise


if __name__ == "__main__":
    add_due_date_column()
    print("Migration completed successfully!")

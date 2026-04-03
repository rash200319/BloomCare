#!/usr/bin/env python3
"""Fix SQLite schema by adding missing is_active column to patients table"""

import sqlite3
import sys


def fix_sqlite_schema():
    db_path = 'd:\\z\\aithon\\bloomcare_local.db'

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if is_active column exists
        cursor.execute("PRAGMA table_info(patients)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f'Existing columns: {columns}')

        if 'is_active' not in columns:
            print('Adding is_active column...')
            cursor.execute(
                'ALTER TABLE patients ADD COLUMN is_active BOOLEAN DEFAULT 1')
            conn.commit()
            print('✓ Column added successfully')
        else:
            print('✓ Column already exists')

        # Also check and fix the second database if needed
        db_path2 = 'd:\\z\\aithon\\backend\\bloomcare_local.db'
        conn2 = sqlite3.connect(db_path2)
        cursor2 = conn2.cursor()

        cursor2.execute("PRAGMA table_info(patients)")
        columns2 = [col[1] for col in cursor2.fetchall()]

        if 'is_active' not in columns2:
            print(f'\nAdding is_active column to {db_path2}...')
            cursor2.execute(
                'ALTER TABLE patients ADD COLUMN is_active BOOLEAN DEFAULT 1')
            conn2.commit()
            print('✓ Column added successfully')
        else:
            print(f'\n✓ Column already exists in {db_path2}')

        conn.close()
        conn2.close()
        print('\n✅ All databases updated!')

    except Exception as e:
        print(f'❌ Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    fix_sqlite_schema()

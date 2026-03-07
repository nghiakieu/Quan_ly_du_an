"""
Migration script for v1.3: Add new columns to projects table.
Run this script once to upgrade the database schema.
"""
import sqlite3

def upgrade_v1_3_phase_a():
    conn = sqlite3.connect('sql_app.db')
    cursor = conn.cursor()
    
    # New columns for projects table
    new_columns = [
        ("investor", "VARCHAR"),
        ("total_budget", "FLOAT"),
        ("start_date", "DATETIME"),
        ("end_date", "DATETIME"),
    ]
    
    for col_name, col_type in new_columns:
        try:
            cursor.execute(f'ALTER TABLE projects ADD COLUMN {col_name} {col_type}')
            print(f"[OK] Added column '{col_name}' to projects table.")
        except Exception as e:
            print(f"[SKIP] Column '{col_name}' already exists or error: {e}")
    
    conn.commit()
    conn.close()
    print("\n--- Migration v1.3 Phase A completed ---")

if __name__ == '__main__':
    upgrade_v1_3_phase_a()

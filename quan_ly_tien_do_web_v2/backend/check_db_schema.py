from sqlalchemy import create_engine, inspect
import os

# Database URL
DB_URL = "sqlite:///c:/Users/KTTC CAU - NGHIA/Quan_ly_tien_do/quan_ly_tien_do_web_v2/backend/sql_app.db"

def check_schema():
    print(f"Checking database at: {DB_URL}")
    engine = create_engine(DB_URL)
    inspector = inspect(engine)
    
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")
    
    if "diagrams" in tables:
        columns = inspector.get_columns("diagrams")
        print("\nColumns in 'diagrams' table:")
        for col in columns:
            print(f" - {col['name']} ({col['type']})")
    else:
        print("\n'diagrams' table NOT FOUND!")

if __name__ == "__main__":
    check_schema()

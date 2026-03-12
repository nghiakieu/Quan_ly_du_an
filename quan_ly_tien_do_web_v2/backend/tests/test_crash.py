import sys
import traceback
import os
sys.path.append(os.getcwd())

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.api.api_v1.endpoints.projects import read_projects
    from app.db.database import SessionLocal

    print('Testing DB Connection...')
    db = SessionLocal()
    print('Calling read_projects...')
    projects = read_projects(db=db, skip=0, limit=10)
    print(f'Success! Found {len(projects)} projects')
    for p in projects:
        print(f"Project: {p.id} - {p.name}")
except Exception as e:
    print('\n❌ CRITICAL ERROR IN READ_PROJECTS API:')
    traceback.print_exc()

import sys
import os

# Thêm thư mục backend vào sys.path
backend_path = os.path.abspath(os.path.join(os.getcwd(), "backend"))
if backend_path not in sys.path:
    sys.path.append(backend_path)

from app.models.project import Project
from app.schemas.project import ProjectCreate

def test_defaults():
    print("--- Checking Model Default ---")
    p = Project(name="Test Project")
    # SQLAlchemy defaults are usually applied at flush/commit time if defined as 'default'
    # but we can check the column property
    from sqlalchemy import inspect
    mapper = inspect(Project)
    status_column = mapper.columns['status']
    print(f"Model status default: {status_column.default.arg}")

    print("\n--- Checking Schema Default ---")
    p_schema = ProjectCreate(name="Test Schema")
    print(f"Schema status default: {p_schema.status}")

    assert status_column.default.arg == "active"
    assert p_schema.status == "active"
    print("\nVerification SUCCESS")

if __name__ == "__main__":
    test_defaults()

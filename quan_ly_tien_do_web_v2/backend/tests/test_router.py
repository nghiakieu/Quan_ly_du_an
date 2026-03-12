import sys
import os
sys.path.append(os.getcwd())

try:
    from app.main import app
    print("Router OK! All modules imported correctly.")
except Exception as e:
    import traceback
    print("Failed to import main application.")
    traceback.print_exc()

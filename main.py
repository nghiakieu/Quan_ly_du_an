"""
Quản lý Tiến độ Xây dựng - Desktop Application
Construction Progress Management with Visual Blocks

Entry point for the application.
"""

import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from app.app import main

if __name__ == "__main__":
    main()

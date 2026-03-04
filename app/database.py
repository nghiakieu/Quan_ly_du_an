"""
Database module for SQLite operations.
Handles all database connections and queries.
"""

import sqlite3
import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

# Database file path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'project.db')


def get_connection() -> sqlite3.Connection:
    """Get database connection with row factory."""
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize database with schema."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#808080',
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
    ''')
    
    # Create blocks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            category_id INTEGER,
            code TEXT NOT NULL,
            
            -- Geometry position (for canvas)
            pos_x REAL DEFAULT 0,
            pos_y REAL DEFAULT 0,
            width REAL DEFAULT 60,
            height REAL DEFAULT 40,
            diameter REAL DEFAULT 0,
            shape TEXT DEFAULT 'rect',
            view_type TEXT DEFAULT 'plan',
            
            -- Logical position
            pier TEXT,
            span TEXT,
            segment TEXT,
            
            -- Volume & Value
            volume REAL,
            unit TEXT DEFAULT 'm³',
            unit_price REAL,
            total_value REAL,
            
            -- Status: 0=Not Started, 1=In Progress, 2=Completed
            status INTEGER DEFAULT 0,
            completed_at DATE,
            notes TEXT,
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    ''')
    
    # Add new columns to existing tables (for migration)
    try:
        cursor.execute("ALTER TABLE blocks ADD COLUMN diameter REAL DEFAULT 0")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE blocks ADD COLUMN shape TEXT DEFAULT 'rect'")
    except:
        pass
    
    conn.commit()
    conn.close()


# ============== PROJECT OPERATIONS ==============

def create_project(name: str, description: str = "") -> int:
    """Create a new project and return its ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO projects (name, description) VALUES (?, ?)",
        (name, description)
    )
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return project_id


def get_all_projects() -> List[Dict]:
    """Get all projects."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY created_at DESC")
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return projects


def get_project(project_id: int) -> Optional[Dict]:
    """Get a single project by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


# ============== CATEGORY OPERATIONS ==============

def create_category(project_id: int, name: str, color: str = "#808080") -> int:
    """Create a new category and return its ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO categories (project_id, name, color) VALUES (?, ?, ?)",
        (project_id, name, color)
    )
    category_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return category_id


def get_categories(project_id: int) -> List[Dict]:
    """Get all categories for a project."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM categories WHERE project_id = ? ORDER BY name",
        (project_id,)
    )
    categories = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return categories


def get_or_create_category(project_id: int, name: str, color: str = "#808080") -> int:
    """Get existing category or create new one."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id FROM categories WHERE project_id = ? AND name = ?",
        (project_id, name)
    )
    row = cursor.fetchone()
    if row:
        conn.close()
        return row['id']
    
    cursor.execute(
        "INSERT INTO categories (project_id, name, color) VALUES (?, ?, ?)",
        (project_id, name, color)
    )
    category_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return category_id


# ============== BLOCK OPERATIONS ==============

def create_block(
    project_id: int,
    category_id: int,
    code: str,
    pos_x: float = 0,
    pos_y: float = 0,
    width: float = 60,
    height: float = 40,
    diameter: float = 0,
    shape: str = "rect",
    view_type: str = "plan",
    pier: str = "",
    span: str = "",
    segment: str = "",
    volume: float = None,
    unit: str = "m³",
    unit_price: float = None,
    status: int = 0,
    notes: str = ""
) -> int:
    """Create a new block and return its ID."""
    total_value = None
    if volume is not None and unit_price is not None:
        total_value = volume * unit_price
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO blocks (
            project_id, category_id, code,
            pos_x, pos_y, width, height, diameter, shape, view_type,
            pier, span, segment,
            volume, unit, unit_price, total_value,
            status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        project_id, category_id, code,
        pos_x, pos_y, width, height, diameter, shape, view_type,
        pier, span, segment,
        volume, unit, unit_price, total_value,
        status, notes
    ))
    block_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return block_id


def get_blocks(project_id: int, view_type: str = None) -> List[Dict]:
    """Get all blocks for a project, optionally filtered by view type."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if view_type:
        cursor.execute(
            "SELECT b.*, c.name as category_name, c.color as category_color "
            "FROM blocks b "
            "LEFT JOIN categories c ON b.category_id = c.id "
            "WHERE b.project_id = ? AND b.view_type = ? "
            "ORDER BY b.code",
            (project_id, view_type)
        )
    else:
        cursor.execute(
            "SELECT b.*, c.name as category_name, c.color as category_color "
            "FROM blocks b "
            "LEFT JOIN categories c ON b.category_id = c.id "
            "WHERE b.project_id = ? "
            "ORDER BY b.code",
            (project_id,)
        )
    
    blocks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return blocks


def get_block(block_id: int) -> Optional[Dict]:
    """Get a single block by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT b.*, c.name as category_name, c.color as category_color "
        "FROM blocks b "
        "LEFT JOIN categories c ON b.category_id = c.id "
        "WHERE b.id = ?",
        (block_id,)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_block(block_id: int, **kwargs) -> bool:
    """Update a block with given fields."""
    if not kwargs:
        return False
    
    # Recalculate total_value if volume or unit_price changed
    if 'volume' in kwargs or 'unit_price' in kwargs:
        block = get_block(block_id)
        if block:
            volume = kwargs.get('volume', block['volume'])
            unit_price = kwargs.get('unit_price', block['unit_price'])
            if volume is not None and unit_price is not None:
                kwargs['total_value'] = volume * unit_price
    
    # Add updated_at
    kwargs['updated_at'] = datetime.now().isoformat()
    
    # Build UPDATE query
    set_clause = ", ".join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [block_id]
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"UPDATE blocks SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return True


def update_block_status(block_id: int, status: int) -> bool:
    """Update block status with completed_at if completed."""
    completed_at = None
    if status == 2:  # Completed
        completed_at = datetime.now().strftime('%Y-%m-%d')
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE blocks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
        (status, completed_at, datetime.now().isoformat(), block_id)
    )
    conn.commit()
    conn.close()
    return True


def delete_block(block_id: int) -> bool:
    """Delete a block."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM blocks WHERE id = ?", (block_id,))
    conn.commit()
    conn.close()
    return True


def update_block_position(block_id: int, pos_x: float, pos_y: float) -> bool:
    """Update block position on canvas."""
    return update_block(block_id, pos_x=pos_x, pos_y=pos_y)


# ============== STATISTICS ==============

def get_project_stats(project_id: int) -> Dict:
    """Get project statistics."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total blocks and by status
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as not_started,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as completed,
            SUM(COALESCE(total_value, 0)) as total_value,
            SUM(CASE WHEN status = 2 THEN COALESCE(total_value, 0) ELSE 0 END) as completed_value
        FROM blocks WHERE project_id = ?
    ''', (project_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        total = row['total'] or 0
        completed = row['completed'] or 0
        progress = (completed / total * 100) if total > 0 else 0
        
        return {
            'total_blocks': total,
            'not_started': row['not_started'] or 0,
            'in_progress': row['in_progress'] or 0,
            'completed': completed,
            'progress_percent': round(progress, 1),
            'total_value': row['total_value'] or 0,
            'completed_value': row['completed_value'] or 0
        }
    
    return {
        'total_blocks': 0,
        'not_started': 0,
        'in_progress': 0,
        'completed': 0,
        'progress_percent': 0,
        'total_value': 0,
        'completed_value': 0
    }


def get_monthly_stats(project_id: int) -> List[Dict]:
    """Get monthly completion statistics."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            strftime('%Y-%m', completed_at) as month,
            COUNT(*) as block_count,
            SUM(COALESCE(total_value, 0)) as value
        FROM blocks 
        WHERE project_id = ? AND status = 2 AND completed_at IS NOT NULL
        GROUP BY strftime('%Y-%m', completed_at)
        ORDER BY month
    ''', (project_id,))
    
    stats = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return stats


# ============== EXPORT / IMPORT DIAGRAM ==============

DIAGRAM_FORMAT_VERSION = "1.0"


def export_project_data(project_id: int) -> Dict:
    """Export all project data (project info, categories, blocks) as a serializable dict."""
    project = get_project(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    categories = get_categories(project_id)
    blocks = get_blocks(project_id)

    _skip_block_fields = {"id", "project_id", "category_id", "created_at", "updated_at", "total_value"}
    cat_map = {c["id"]: c["name"] for c in categories}

    exported_blocks = []
    for block in blocks:
        b = {k: v for k, v in block.items() if k not in _skip_block_fields}
        b["category_name"] = cat_map.get(block.get("category_id"), "Chung")
        exported_blocks.append(b)

    exported_categories = [
        {"name": c["name"], "color": c.get("color", "#808080")}
        for c in categories
    ]

    return {
        "format": "diagram_backup",
        "version": DIAGRAM_FORMAT_VERSION,
        "exported_at": datetime.now().isoformat(),
        "project": {
            "name": project["name"],
            "description": project.get("description", ""),
        },
        "categories": exported_categories,
        "blocks": exported_blocks,
    }


def import_project_data(data: Dict, target_project_id: int = None) -> int:
    """
    Import diagram data from an exported dict.
    If target_project_id is None: create a brand-new project.
    If target_project_id is given: CLEAR existing blocks/categories and restore.
    Returns the project_id that was written to.
    """
    fmt = data.get("format")
    if fmt != "diagram_backup":
        raise ValueError("File khong phai dinh dang so do hop le!")

    project_info = data.get("project", {})
    categories_data = data.get("categories", [])
    blocks_data = data.get("blocks", [])

    conn = get_connection()
    cursor = conn.cursor()

    try:
        if target_project_id is None:
            project_name = project_info.get("name", "Import") + " (Import)"
            cursor.execute(
                "INSERT INTO projects (name, description) VALUES (?, ?)",
                (project_name, project_info.get("description", ""))
            )
            project_id = cursor.lastrowid
        else:
            project_id = target_project_id
            cursor.execute("DELETE FROM blocks WHERE project_id = ?", (project_id,))
            cursor.execute("DELETE FROM categories WHERE project_id = ?", (project_id,))

        cat_name_to_id = {}
        for cat in categories_data:
            cursor.execute(
                "INSERT INTO categories (project_id, name, color) VALUES (?, ?, ?)",
                (project_id, cat["name"], cat.get("color", "#808080"))
            )
            cat_name_to_id[cat["name"]] = cursor.lastrowid

        if "Chung" not in cat_name_to_id:
            cursor.execute(
                "INSERT INTO categories (project_id, name, color) VALUES (?, ?, ?)",
                (project_id, "Chung", "#6B7280")
            )
            cat_name_to_id["Chung"] = cursor.lastrowid

        for b in blocks_data:
            cat_name = b.get("category_name", "Chung")
            cat_id = cat_name_to_id.get(cat_name) or cat_name_to_id.get("Chung")

            volume = b.get("volume")
            unit_price = b.get("unit_price")
            total_value = None
            if volume is not None and unit_price is not None:
                try:
                    total_value = float(volume) * float(unit_price)
                except (TypeError, ValueError):
                    total_value = None

            cursor.execute(
                """INSERT INTO blocks (
                    project_id, category_id, code,
                    pos_x, pos_y, width, height, diameter, shape, view_type,
                    pier, span, segment,
                    volume, unit, unit_price, total_value,
                    status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    project_id, cat_id, b.get("code", ""),
                    b.get("pos_x", 0), b.get("pos_y", 0),
                    b.get("width", 60), b.get("height", 40),
                    b.get("diameter", 0), b.get("shape", "rect"),
                    b.get("view_type", "plan"),
                    b.get("pier", ""), b.get("span", ""), b.get("segment", ""),
                    volume, b.get("unit", "m3"), unit_price, total_value,
                    b.get("status", 0), b.get("notes", "")
                )
            )

        conn.commit()
        return project_id

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

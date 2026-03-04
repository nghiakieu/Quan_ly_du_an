"""
Main Application - Construction Progress Management Desktop App.
Quản lý tiến độ - sản lượng dự án xây dựng bằng block trực quan.
"""

import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import database as db
from app.canvas.block_canvas import BlockCanvas
from app.panels.dashboard import DashboardPanel
from app.panels.data_panel import DataPanel
from app.panels.shapes_panel import ShapesPanel
from app.dialogs.block_dialog import BlockEditDialog
from app.dialogs.import_dialog import ImportDialog
from app.dialogs.diagram_io_dialog import ExportDiagramDialog, ImportDiagramDialog
from app.utils import excel_engine


# App settings
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


class MainApplication(ctk.CTk):
    """Main application window with single infinite canvas."""
    
    def __init__(self):
        super().__init__()
        
        # Window setup
        self.title("🏗️ Quản lý Tiến độ Xây dựng - Block Trực quan")
        self.geometry("1500x850")
        self.minsize(1200, 700)
        
        # State
        self.current_project_id = None
        self.categories = []
        self.draw_mode = False
        
        # Initialize database
        db.init_database()
        
        # Create UI
        self._create_menu()
        self._create_toolbar()
        self._create_layout()
        self._create_statusbar()
        
        # Load or create initial project
        self._load_initial_project()
        
        # Bind window close
        self.protocol("WM_DELETE_WINDOW", self._on_close)
    
    def _create_menu(self):
        """Create top menu bar."""
        self.menu_frame = ctk.CTkFrame(self, height=55, corner_radius=0)
        self.menu_frame.pack(fill="x")
        self.menu_frame.pack_propagate(False)
        
        # Left side - Logo and project name
        left_frame = ctk.CTkFrame(self.menu_frame, fg_color="transparent")
        left_frame.pack(side="left", padx=15, pady=10)
        
        logo = ctk.CTkLabel(
            left_frame,
            text="🏗️",
            font=("Arial", 28)
        )
        logo.pack(side="left", padx=(0, 10))
        
        self.project_label = ctk.CTkLabel(
            left_frame,
            text="Chưa có dự án",
            font=("Arial", 16, "bold")
        )
        self.project_label.pack(side="left")
        
        # Right side - Action buttons
        right_frame = ctk.CTkFrame(self.menu_frame, fg_color="transparent")
        right_frame.pack(side="right", padx=15)
        
        # New project
        self.new_btn = ctk.CTkButton(
            right_frame,
            text="📁 Mới",
            width=90,
            height=35,
            command=self._new_project
        )
        self.new_btn.pack(side="left", padx=5)
        
        # Import Excel
        self.import_btn = ctk.CTkButton(
            right_frame,
            text="📥 Import",
            width=90,
            height=35,
            fg_color="#0891B2",
            hover_color="#0E7490",
            command=self._import_excel
        )
        self.import_btn.pack(side="left", padx=5)
        
        # Export Excel
        self.export_btn = ctk.CTkButton(
            right_frame,
            text="📤 Export",
            width=90,
            height=35,
            fg_color="#7C3AED",
            hover_color="#6D28D9",
            command=self._export_excel
        )
        self.export_btn.pack(side="left", padx=5)
        
        # Create sample template
        self.sample_btn = ctk.CTkButton(
            right_frame,
            text="📋 Mẫu Excel",
            width=110,
            height=35,
            fg_color="#059669",
            hover_color="#047857",
            command=self._create_sample_excel
        )
        self.sample_btn.pack(side="left", padx=5)
        
        # Separator
        sep2 = ctk.CTkLabel(right_frame, text="｜", text_color="#374151", font=("Arial", 14))
        sep2.pack(side="left", padx=2)
        
        # Export Diagram JSON
        self.export_diagram_btn = ctk.CTkButton(
            right_frame,
            text="💾 Lưu Sơ đồ",
            width=115,
            height=35,
            fg_color="#065F46",
            hover_color="#047857",
            command=self._export_diagram
        )
        self.export_diagram_btn.pack(side="left", padx=5)
        
        # Import Diagram JSON
        self.import_diagram_btn = ctk.CTkButton(
            right_frame,
            text="📂 Tải Sơ đồ",
            width=115,
            height=35,
            fg_color="#1E3A5F",
            hover_color="#1E40AF",
            command=self._import_diagram
        )
        self.import_diagram_btn.pack(side="left", padx=5)
    
    def _create_toolbar(self):
        """Create drawing toolbar."""
        self.toolbar_frame = ctk.CTkFrame(self, height=45, corner_radius=0, fg_color="#1f2937")
        self.toolbar_frame.pack(fill="x")
        self.toolbar_frame.pack_propagate(False)
        
        # Tool label
        tool_label = ctk.CTkLabel(
            self.toolbar_frame,
            text="🛠️ Công cụ:",
            font=("Arial", 12)
        )
        tool_label.pack(side="left", padx=(15, 10), pady=8)
        
        # Select mode button
        self.select_btn = ctk.CTkButton(
            self.toolbar_frame,
            text="👆 Chọn",
            width=80,
            height=30,
            fg_color="#3B82F6",
            command=self._set_select_mode
        )
        self.select_btn.pack(side="left", padx=3)
        
        # Draw rectangle button
        self.draw_rect_btn = ctk.CTkButton(
            self.toolbar_frame,
            text="▭ Vẽ HCN",
            width=90,
            height=30,
            fg_color="#6B7280",
            command=self._set_draw_rect_mode
        )
        self.draw_rect_btn.pack(side="left", padx=3)
        
        # Draw circle button
        self.draw_circle_btn = ctk.CTkButton(
            self.toolbar_frame,
            text="⚪ Vẽ Tròn",
            width=90,
            height=30,
            fg_color="#6B7280",
            command=self._set_draw_circle_mode
        )
        self.draw_circle_btn.pack(side="left", padx=3)
        
        # Separator
        sep = ctk.CTkLabel(self.toolbar_frame, text="|", text_color="#4B5563")
        sep.pack(side="left", padx=10)
        
        # Fit view button
        self.fit_btn = ctk.CTkButton(
            self.toolbar_frame,
            text="🔍 Fit",
            width=70,
            height=30,
            fg_color="#6B7280",
            command=self._fit_view
        )
        self.fit_btn.pack(side="left", padx=3)
        
        # Zoom indicator
        self.zoom_label = ctk.CTkLabel(
            self.toolbar_frame,
            text="Zoom: 100%",
            font=("Arial", 11)
        )
        self.zoom_label.pack(side="left", padx=15)
        
        # Right side - mode indicator
        self.mode_label = ctk.CTkLabel(
            self.toolbar_frame,
            text="📌 Chế độ: CHỌN",
            font=("Arial", 12, "bold"),
            text_color="#60A5FA"
        )
        self.mode_label.pack(side="right", padx=15)
    
    def _create_layout(self):
        """Create main layout with single canvas and panels."""
        # Main container
        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Left panel - Dashboard
        self.dashboard = DashboardPanel(main_frame, width=280)
        self.dashboard.pack(side="left", fill="y", padx=(0, 10))
        self.dashboard.pack_propagate(False)
        
        # Center - Single canvas (no tabs)
        canvas_container = ctk.CTkFrame(main_frame, fg_color="#111827")
        canvas_container.pack(side="left", fill="both", expand=True, padx=(0, 10))
        
        # Canvas header
        canvas_header = ctk.CTkFrame(canvas_container, height=35, fg_color="#1f2937")
        canvas_header.pack(fill="x")
        canvas_header.pack_propagate(False)
        
        ctk.CTkLabel(
            canvas_header,
            text="🎨 Mô hình công trình",
            font=("Arial", 13, "bold")
        ).pack(side="left", padx=10, pady=5)
        
        # Help text
        help_text = "Click: Toggle | Phải: Sửa | Quét: Chọn nhiều | Del: Xóa | Scroll: Zoom"
        ctk.CTkLabel(
            canvas_header,
            text=help_text,
            font=("Arial", 10),
            text_color="#9CA3AF"
        ).pack(side="right", padx=10)
        
        # Single canvas
        self.canvas = BlockCanvas(
            canvas_container,
            on_block_status_change=self._on_status_change,
            on_block_right_click=self._on_block_right_click,
            on_block_move=self._on_block_move,
            on_block_created=self._on_block_created,
            on_blocks_delete=self._on_blocks_delete
        )
        self.canvas.pack(fill="both", expand=True, padx=2, pady=2)
        
        # Bind scroll to update zoom label
        self.canvas.canvas.bind("<MouseWheel>", self._update_zoom_label, add="+")
        
        # Right side container
        right_container = ctk.CTkFrame(main_frame, fg_color="transparent")
        right_container.pack(side="right", fill="y")
        
        # Shapes panel
        self.shapes_panel = ShapesPanel(
            right_container,
            width=180,
            on_drop_to_canvas=self._on_shape_dropped
        )
        self.shapes_panel.pack(fill="x", pady=(0, 10))
        
        # Data panel
        self.data_panel = DataPanel(
            right_container,
            width=180,
            on_block_select=self._on_block_select,
            on_add_block=self._add_new_block
        )
        self.data_panel.pack(fill="both", expand=True)
    
    def _create_statusbar(self):
        """Create status bar at bottom."""
        self.status_bar = ctk.CTkFrame(self, height=30, corner_radius=0, fg_color="#111827")
        self.status_bar.pack(fill="x")
        self.status_bar.pack_propagate(False)
        
        self.status_label = ctk.CTkLabel(
            self.status_bar,
            text="✅ Sẵn sàng",
            font=("Arial", 11),
            text_color="#9CA3AF"
        )
        self.status_label.pack(side="left", padx=15, pady=5)
        
        # Block count
        self.block_count_label = ctk.CTkLabel(
            self.status_bar,
            text="Blocks: 0",
            font=("Arial", 11),
            text_color="#9CA3AF"
        )
        self.block_count_label.pack(side="right", padx=15, pady=5)
    
    def _set_select_mode(self):
        """Switch to select mode."""
        self.draw_mode = False
        self.canvas.set_mode(BlockCanvas.MODE_SELECT)
        
        # Update button colors
        self.select_btn.configure(fg_color="#3B82F6")
        self.draw_rect_btn.configure(fg_color="#6B7280")
        self.draw_circle_btn.configure(fg_color="#6B7280")
        
        # Update mode label
        self.mode_label.configure(text="📌 Chế độ: CHỌN", text_color="#60A5FA")
        self._set_status("Chế độ CHỌN: Click vào block để đổi trạng thái")
    
    def _set_draw_rect_mode(self):
        """Switch to draw rectangle mode."""
        self.draw_mode = True
        self.canvas.set_mode(BlockCanvas.MODE_DRAW_RECT)
        
        # Update button colors
        self.select_btn.configure(fg_color="#6B7280")
        self.draw_rect_btn.configure(fg_color="#10B981")
        self.draw_circle_btn.configure(fg_color="#6B7280")
        
        # Update mode label
        self.mode_label.configure(text="▭ Chế độ: VẼ HCN", text_color="#34D399")
        self._set_status("Chế độ VẼ HCN: Kéo chuột để vẽ block hình chữ nhật")
    
    def _set_draw_circle_mode(self):
        """Switch to draw circle mode."""
        self.draw_mode = True
        self.canvas.set_mode(BlockCanvas.MODE_DRAW_CIRCLE)
        
        # Update button colors
        self.select_btn.configure(fg_color="#6B7280")
        self.draw_rect_btn.configure(fg_color="#6B7280")
        self.draw_circle_btn.configure(fg_color="#10B981")
        
        # Update mode label
        self.mode_label.configure(text="⚪ Chế độ: VẼ TRÒN", text_color="#34D399")
        self._set_status("Chế độ VẼ TRÒN: Kéo chuột để vẽ block hình tròn")
    
    def _on_shape_dropped(self, canvas_widget, canvas_x: int, canvas_y: int, shape_data: dict, block_name: str):
        """Handle shape dropped from ShapesPanel onto canvas."""
        if not self.current_project_id:
            return
        
        shape = shape_data.get('shape', 'rect')
        
        # Convert canvas coords to world coords using the canvas
        wx, wy = self.canvas._screen_to_world(canvas_x, canvas_y)
        
        if shape == 'circle':
            diameter = shape_data.get('diameter', 50)
            self._create_block_from_drop(wx, wy, diameter, 0, 'circle', block_name)
        else:
            width = shape_data.get('width', 60)
            height = shape_data.get('height', 40)
            self._create_block_from_drop(wx, wy, width, height, 'rect', block_name)
    
    def _create_block_from_drop(self, x: float, y: float, width_or_diameter: float, height: float, shape: str, name: str):
        """Create a block from drag-drop with given name."""
        if not self.current_project_id:
            return
        
        # Ensure category exists
        if not self.categories:
            db.create_category(self.current_project_id, "Chung", "#6B7280")
            self.categories = db.get_categories(self.current_project_id)
        
        # Create block
        if shape == "circle":
            block_id = db.create_block(
                project_id=self.current_project_id,
                category_id=self.categories[0]['id'],
                code=name,
                pos_x=x,
                pos_y=y,
                width=0,
                height=0,
                diameter=width_or_diameter,
                shape=shape,
                view_type="plan"
            )
        else:
            block_id = db.create_block(
                project_id=self.current_project_id,
                category_id=self.categories[0]['id'],
                code=name,
                pos_x=x,
                pos_y=y,
                width=width_or_diameter,
                height=height,
                diameter=0,
                shape=shape,
                view_type="plan"
            )
        
        # Refresh
        block = db.get_block(block_id)
        if block:
            self.canvas.add_block(block)
            self.data_panel.load_blocks(db.get_blocks(self.current_project_id))
            stats = db.get_project_stats(self.current_project_id)
            self.dashboard.update_stats(stats)
            self._set_status(f"✅ Đã tạo block: {name}")
    
    def _update_zoom_label(self, event=None):
        """Update zoom level display."""
        self.after(100, lambda: self.zoom_label.configure(
            text=f"Zoom: {self.canvas.get_zoom_level():.0f}%"
        ))
    
    def _set_status(self, message: str):
        """Update status bar message."""
        self.status_label.configure(text=message)
    
    def _load_initial_project(self):
        """Load existing project or create new one."""
        projects = db.get_all_projects()
        
        if projects:
            self._load_project(projects[0]['id'])
        else:
            project_id = db.create_project(
                "Dự án mới",
                "Dự án được tạo tự động"
            )
            self._load_project(project_id)
    
    def _load_project(self, project_id: int):
        """Load a project and refresh UI."""
        self.current_project_id = project_id
        project = db.get_project(project_id)
        
        if project:
            self.project_label.configure(text=project['name'])
        
        self.categories = db.get_categories(project_id)
        self._refresh_blocks()
    
    def _refresh_blocks(self):
        """Refresh all block displays."""
        if not self.current_project_id:
            return
        
        all_blocks = db.get_blocks(self.current_project_id)
        
        # Load into canvas
        self.canvas.load_blocks(all_blocks)
        
        # Load into data panel
        self.data_panel.load_blocks(all_blocks)
        
        # Update dashboard
        stats = db.get_project_stats(self.current_project_id)
        self.dashboard.update_stats(stats)
        
        # Update status
        self.block_count_label.configure(text=f"Blocks: {len(all_blocks)}")
        
        # Fit view after delay
        self.after(100, self._fit_view)
    
    def _on_status_change(self, block_id: int, new_status: int):
        """Handle block status change from canvas."""
        db.update_block_status(block_id, new_status)
        
        block = db.get_block(block_id)
        if block:
            self.canvas.update_block_data(block_id, {'status': new_status})
            self.data_panel.update_block(block_id, block)
        
        stats = db.get_project_stats(self.current_project_id)
        self.dashboard.update_stats(stats)
        
        status_names = {0: "Chưa thi công", 1: "Đang thi công", 2: "Hoàn thành"}
        self._set_status(f"✅ {block.get('code', '')} → {status_names.get(new_status, '')}")
    
    def _on_block_right_click(self, block_id: int, x: int, y: int):
        """Handle right click on block - open edit dialog."""
        block = db.get_block(block_id)
        if not block:
            return
        
        self.categories = db.get_categories(self.current_project_id)
        
        BlockEditDialog(
            self,
            block=block,
            categories=self.categories,
            on_save=self._on_block_save,
            on_delete=self._on_block_delete
        )
    
    def _on_block_save(self, data: dict):
        """Handle block save from edit dialog."""
        block_id = data.pop('id')
        db.update_block(block_id, **data)
        self._refresh_blocks()
        self._set_status(f"✅ Đã lưu Block {data.get('code', '')}")
    
    def _on_block_delete(self, block_id: int):
        """Handle block delete from edit dialog."""
        db.delete_block(block_id)
        self._refresh_blocks()
        self._set_status("🗑️ Đã xóa block")
    
    def _on_block_move(self, block_id: int, new_x: float, new_y: float):
        """Handle block move from canvas."""
        db.update_block_position(block_id, new_x, new_y)
    
    def _on_blocks_delete(self, block_ids: list):
        """Handle deletion of multiple blocks from canvas."""
        if not block_ids:
            return
        
        if len(block_ids) == 1:
            confirm_msg = "Bạn có chắc muốn xóa block đã chọn?"
        else:
            confirm_msg = f"Bạn có chắc muốn xóa {len(block_ids)} blocks đã chọn?"
        
        if messagebox.askyesno("Xác nhận xóa", confirm_msg):
            for block_id in block_ids:
                db.delete_block(block_id)
            
            self._refresh_blocks()
            self._set_status(f"🗑️ Đã xóa {len(block_ids)} blocks")
    
    def _on_block_created(self, x: float, y: float, width_or_diameter: float, height: float, shape: str = "rect"):
        """Handle new block created by drawing."""
        if not self.current_project_id:
            return
        
        # Ensure category exists
        if not self.categories:
            cat_id = db.create_category(self.current_project_id, "Chung", "#6B7280")
            self.categories = db.get_categories(self.current_project_id)
        
        # Generate code
        all_blocks = db.get_blocks(self.current_project_id)
        code = f"B{len(all_blocks) + 1}"
        
        # Create block with shape data
        if shape == "circle":
            block_id = db.create_block(
                project_id=self.current_project_id,
                category_id=self.categories[0]['id'],
                code=code,
                pos_x=x,
                pos_y=y,
                width=0,
                height=0,
                diameter=width_or_diameter,
                shape=shape,
                view_type="plan"
            )
        else:
            block_id = db.create_block(
                project_id=self.current_project_id,
                category_id=self.categories[0]['id'],
                code=code,
                pos_x=x,
                pos_y=y,
                width=width_or_diameter,
                height=height,
                diameter=0,
                shape=shape,
                view_type="plan"
            )
        
        # Refresh and open edit dialog
        block = db.get_block(block_id)
        if block:
            self.canvas.add_block(block)
            self.data_panel.load_blocks(db.get_blocks(self.current_project_id))
            
            stats = db.get_project_stats(self.current_project_id)
            self.dashboard.update_stats(stats)
            self.block_count_label.configure(text=f"Blocks: {len(all_blocks) + 1}")
            
            # Open edit dialog for new block
            BlockEditDialog(
                self,
                block=block,
                categories=self.categories,
                on_save=self._on_block_save,
                on_delete=self._on_block_delete
            )
            
            self._set_status(f"✅ Đã tạo block mới: {code}")
    
    def _on_block_select(self, block_id: int):
        """Handle block selection from data panel."""
        block = db.get_block(block_id)
        if block:
            self._set_status(f"Đã chọn: {block.get('code', '')} - {block.get('category_name', '')}")
    
    def _add_new_block(self):
        """Add a new block via button."""
        if not self.current_project_id:
            messagebox.showerror("Lỗi", "Chưa có dự án!")
            return
        
        if not self.categories:
            cat_id = db.create_category(self.current_project_id, "Chung", "#6B7280")
            self.categories = db.get_categories(self.current_project_id)
        
        # Create block at default position
        all_blocks = db.get_blocks(self.current_project_id)
        block_id = db.create_block(
            project_id=self.current_project_id,
            category_id=self.categories[0]['id'],
            code=f"B{len(all_blocks) + 1}",
            pos_x=50 + len(all_blocks) * 10,
            pos_y=50 + len(all_blocks) * 10,
            width=80,
            height=50,
            view_type="plan"
        )
        
        block = db.get_block(block_id)
        if block:
            BlockEditDialog(
                self,
                block=block,
                categories=self.categories,
                on_save=self._on_block_save,
                on_delete=self._on_block_delete
            )
        
        self._refresh_blocks()
    
    def _new_project(self):
        """Create a new project."""
        dialog = ctk.CTkInputDialog(
            text="Nhập tên dự án:",
            title="Tạo dự án mới"
        )
        name = dialog.get_input()
        
        if name:
            project_id = db.create_project(name)
            
            categories = [
                ("Cọc khoan nhồi", "#3B82F6"),
                ("Bệ trụ", "#8B5CF6"),
                ("Thân trụ", "#EC4899"),
                ("Xà mũ", "#F59E0B"),
                ("Dầm", "#10B981"),
                ("Mặt cầu", "#6366F1")
            ]
            
            for cat_name, color in categories:
                db.create_category(project_id, cat_name, color)
            
            self._load_project(project_id)
            messagebox.showinfo("Thành công", f"Đã tạo dự án: {name}")
    
    def _import_excel(self):
        """Import data from Excel file."""
        if not self.current_project_id:
            messagebox.showerror("Lỗi", "Chưa có dự án!")
            return
        
        filepath = filedialog.askopenfilename(
            title="Chọn file Excel",
            filetypes=[("Excel files", "*.xlsx *.xls")]
        )
        
        if not filepath:
            return
        
        try:
            self._set_status("📥 Đang đọc file Excel...")
            
            # Read Excel
            excel_blocks = excel_engine.read_excel(filepath)
            
            # Get current blocks
            db_blocks = db.get_blocks(self.current_project_id)
            
            # Compare
            diff_result = excel_engine.compare_blocks(excel_blocks, db_blocks)
            
            # Check if any changes
            total_changes = (
                len(diff_result['new']) + 
                len(diff_result['changed']) + 
                len(diff_result['deleted'])
            )
            
            if total_changes == 0:
                messagebox.showinfo("Thông báo", "Không có thay đổi nào so với dữ liệu hiện tại.")
                self._set_status("📥 Import: Không có thay đổi")
                return
            
            # Show preview dialog
            dialog = ImportDialog(self, diff_result)
            self.wait_window(dialog)
            
            if dialog.confirmed:
                self._apply_import(excel_blocks, diff_result)
                messagebox.showinfo("Thành công", "Đã import dữ liệu từ Excel!")
                self._refresh_blocks()
                self._set_status(f"✅ Import thành công: {len(diff_result['new'])} mới, {len(diff_result['changed'])} cập nhật")
            else:
                self._set_status("❌ Đã hủy import")
        
        except Exception as e:
            messagebox.showerror("Lỗi", f"Không thể đọc file Excel:\n{str(e)}")
            self._set_status("❌ Lỗi import")
    
    def _apply_import(self, excel_blocks: list, diff_result: dict):
        """Apply imported data to database."""
        # Layout new blocks in a grid
        start_x = 50
        start_y = 50
        col = 0
        row = 0
        max_cols = 8
        
        for block in diff_result['new']:
            cat_name = block.get('category_name', 'Chung')
            cat_id = db.get_or_create_category(self.current_project_id, cat_name)
            
            # Calculate position in grid
            pos_x = start_x + col * 100
            pos_y = start_y + row * 70
            
            db.create_block(
                project_id=self.current_project_id,
                category_id=cat_id,
                code=block.get('code', ''),
                pier=block.get('pier'),
                span=block.get('span'),
                segment=block.get('segment'),
                volume=block.get('volume'),
                unit=block.get('unit', 'm³'),
                unit_price=block.get('unit_price'),
                status=block.get('status', 0),
                notes=block.get('notes'),
                pos_x=pos_x,
                pos_y=pos_y,
                width=80,
                height=50,
                view_type="plan"
            )
            
            col += 1
            if col >= max_cols:
                col = 0
                row += 1
        
        # Update changed blocks
        for excel_block, db_block, changed_fields in diff_result['changed']:
            update_data = {field: excel_block.get(field) for field in changed_fields}
            db.update_block(db_block['id'], **update_data)
    
    def _export_excel(self):
        """Export data to Excel file."""
        if not self.current_project_id:
            messagebox.showerror("Lỗi", "Chưa có dự án!")
            return
        
        project = db.get_project(self.current_project_id)
        default_name = f"{project.get('name', 'Export')}.xlsx".replace(" ", "_")
        
        filepath = filedialog.asksaveasfilename(
            title="Lưu file Excel",
            defaultextension=".xlsx",
            initialfile=default_name,
            filetypes=[("Excel files", "*.xlsx")]
        )
        
        if not filepath:
            return
        
        try:
            blocks = db.get_blocks(self.current_project_id)
            
            excel_engine.export_excel(
                blocks,
                filepath,
                project_name=project.get('name', '')
            )
            
            messagebox.showinfo("Thành công", f"Đã xuất {len(blocks)} blocks ra:\n{filepath}")
            self._set_status(f"📤 Export thành công: {len(blocks)} blocks")
        
        except Exception as e:
            messagebox.showerror("Lỗi", f"Không thể xuất file:\n{str(e)}")
    
    def _create_sample_excel(self):
        """Create sample Excel template."""
        filepath = filedialog.asksaveasfilename(
            title="Lưu file mẫu Excel",
            defaultextension=".xlsx",
            initialfile="Mau_Du_an_Cau.xlsx",
            filetypes=[("Excel files", "*.xlsx")]
        )
        
        if not filepath:
            return
        
        try:
            excel_engine.create_sample_excel(filepath, "bridge")
            messagebox.showinfo(
                "Thành công",
                f"Đã tạo file mẫu:\n{filepath}\n\nBạn có thể chỉnh sửa file này và import vào chương trình."
            )
            self._set_status("📋 Đã tạo file mẫu Excel")
        
        except Exception as e:
            messagebox.showerror("Lỗi", f"Không thể tạo file mẫu:\n{str(e)}")
    
    def _fit_view(self):
        """Fit blocks to view in canvas."""
        self.canvas.fit_to_view()
        self._update_zoom_label()
    
    def _export_diagram(self):
        """Export current project diagram to JSON file."""
        if not self.current_project_id:
            messagebox.showerror("Lỗi", "Chưa có dự án!")
            return
        
        try:
            data = db.export_project_data(self.current_project_id)
        except Exception as e:
            messagebox.showerror("Lỗi", f"Không thể đọc dữ liệu dự án:\n{e}")
            return
        
        def do_save(filepath: str):
            import json as _json
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    _json.dump(data, f, ensure_ascii=False, indent=2)
                messagebox.showinfo(
                    "Thành công",
                    f"Đã lưu sơ đồ ({len(data['blocks'])} blocks) ra:\n{filepath}"
                )
                self._set_status(f"💾 Đã lưu sơ đồ: {len(data['blocks'])} blocks")
            except Exception as exc:
                messagebox.showerror("Lỗi", f"Không thể lưu file:\n{exc}")
        
        ExportDiagramDialog(self, project_data=data, on_export=do_save)
    
    def _import_diagram(self):
        """Import diagram from JSON file."""
        def do_import(data: dict, mode: str):
            try:
                if mode == "replace":
                    project_id = db.import_project_data(data, target_project_id=self.current_project_id)
                    self._load_project(project_id)
                    messagebox.showinfo("Thành công", "Đã khôi phục sơ đồ vào dự án hiện tại!")
                    self._set_status(f"📂 Đã import sơ đồ: {len(data.get('blocks', []))} blocks")
                else:
                    project_id = db.import_project_data(data, target_project_id=None)
                    self._load_project(project_id)
                    messagebox.showinfo("Thành công", f"Đã tạo dự án mới từ file sơ đồ!")
                    self._set_status(f"📂 Đã import dự án mới: {len(data.get('blocks', []))} blocks")
            except Exception as exc:
                messagebox.showerror("Lỗi Import", f"Không thể import sơ đồ:\n{exc}")
        
        ImportDiagramDialog(self, on_confirm=do_import)
    
    def _on_close(self):
        """Handle window close."""
        self.destroy()


def main():
    """Entry point."""
    app = MainApplication()
    app.mainloop()


if __name__ == "__main__":
    main()

"""
Block Edit Dialog - Form for editing block properties with coordinates.
"""

import customtkinter as ctk
from tkinter import messagebox
from typing import Dict, Optional, Callable
from datetime import datetime


class BlockEditDialog(ctk.CTkToplevel):
    """Dialog for editing block properties including coordinates."""
    
    def __init__(
        self,
        master,
        block: Dict,
        categories: list,
        on_save: Callable[[Dict], None] = None,
        on_delete: Callable[[int], None] = None,
        **kwargs
    ):
        super().__init__(master, **kwargs)
        
        self.block = block
        self.categories = categories
        self.on_save = on_save
        self.on_delete = on_delete
        self.result = None
        
        # Window setup
        self.title(f"Chỉnh sửa Block: {block.get('code', '')}")
        self.geometry("520x750")
        self.resizable(False, False)
        
        # Make modal
        self.transient(master)
        self.grab_set()
        
        # Create scrollable container
        self._create_widgets()
        self._load_data()
        
        # Center on parent
        self.update_idletasks()
        x = master.winfo_x() + (master.winfo_width() - 520) // 2
        y = master.winfo_y() + (master.winfo_height() - 750) // 2
        self.geometry(f"+{max(0, x)}+{max(0, y)}")
    
    def _create_widgets(self):
        """Create form widgets."""
        # Main scrollable container
        self.main_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.main_frame.pack(fill="both", expand=True, padx=15, pady=15)
        
        container = self.main_frame
        
        # === Basic Info Section ===
        self._create_section_label(container, "📋 Thông tin cơ bản")
        
        # Code
        self._create_field(container, "Số hiệu:")
        self.code_entry = ctk.CTkEntry(container, width=200)
        self.code_entry.pack(anchor="w", pady=(0, 10))
        
        # Category
        self._create_field(container, "Loại hạng mục:")
        category_names = [c['name'] for c in self.categories] if self.categories else ["Chưa có"]
        self.category_var = ctk.StringVar(value=category_names[0] if category_names else "")
        self.category_menu = ctk.CTkOptionMenu(
            container,
            values=category_names,
            variable=self.category_var,
            width=200
        )
        self.category_menu.pack(anchor="w", pady=(0, 10))
        
        # === COORDINATES Section (NEW) ===
        self._create_section_label(container, "📐 Tọa độ trên Canvas")
        
        coord_frame = ctk.CTkFrame(container, fg_color="#1f2937")
        coord_frame.pack(fill="x", pady=(0, 10), ipady=10)
        
        # X coordinate
        x_frame = ctk.CTkFrame(coord_frame, fg_color="transparent")
        x_frame.pack(fill="x", padx=15, pady=5)
        
        ctk.CTkLabel(x_frame, text="X:", font=("Arial", 12, "bold"), text_color="#60A5FA").pack(side="left")
        self.coord_x_entry = ctk.CTkEntry(x_frame, width=100, placeholder_text="0.0")
        self.coord_x_entry.pack(side="left", padx=(10, 20))
        
        ctk.CTkLabel(x_frame, text="Y:", font=("Arial", 12, "bold"), text_color="#34D399").pack(side="left")
        self.coord_y_entry = ctk.CTkEntry(x_frame, width=100, placeholder_text="0.0")
        self.coord_y_entry.pack(side="left", padx=(10, 0))
        
        # Width and Height
        size_frame = ctk.CTkFrame(coord_frame, fg_color="transparent")
        size_frame.pack(fill="x", padx=15, pady=5)
        
        ctk.CTkLabel(size_frame, text="Rộng:", font=("Arial", 11)).pack(side="left")
        self.width_entry = ctk.CTkEntry(size_frame, width=80, placeholder_text="60")
        self.width_entry.pack(side="left", padx=(5, 15))
        
        ctk.CTkLabel(size_frame, text="Cao:", font=("Arial", 11)).pack(side="left")
        self.height_entry = ctk.CTkEntry(size_frame, width=80, placeholder_text="40")
        self.height_entry.pack(side="left", padx=(5, 0))
        
        # Coordinate hint
        hint_label = ctk.CTkLabel(
            coord_frame,
            text="💡 Gốc tọa độ O(0,0) ở góc trên trái canvas",
            font=("Arial", 10),
            text_color="#9CA3AF"
        )
        hint_label.pack(padx=15, pady=(5, 0), anchor="w")
        
        # === Position Section (logical) ===
        self._create_section_label(container, "📍 Vị trí công trình")
        
        pos_frame = ctk.CTkFrame(container, fg_color="transparent")
        pos_frame.pack(fill="x", pady=(0, 10))
        
        # Pier
        ctk.CTkLabel(pos_frame, text="Trụ:").pack(side="left")
        self.pier_entry = ctk.CTkEntry(pos_frame, width=70)
        self.pier_entry.pack(side="left", padx=(5, 12))
        
        # Span
        ctk.CTkLabel(pos_frame, text="Nhịp:").pack(side="left")
        self.span_entry = ctk.CTkEntry(pos_frame, width=70)
        self.span_entry.pack(side="left", padx=(5, 12))
        
        # Segment
        ctk.CTkLabel(pos_frame, text="Đốt:").pack(side="left")
        self.segment_entry = ctk.CTkEntry(pos_frame, width=70)
        self.segment_entry.pack(side="left", padx=(5, 0))
        
        # === Volume & Price Section ===
        self._create_section_label(container, "💰 Khối lượng & Giá trị")
        
        vol_frame = ctk.CTkFrame(container, fg_color="transparent")
        vol_frame.pack(fill="x", pady=(0, 10))
        
        # Volume
        ctk.CTkLabel(vol_frame, text="Khối lượng:").pack(side="left")
        self.volume_entry = ctk.CTkEntry(vol_frame, width=100)
        self.volume_entry.pack(side="left", padx=(5, 15))
        
        # Unit
        ctk.CTkLabel(vol_frame, text="Đơn vị:").pack(side="left")
        self.unit_var = ctk.StringVar(value="m³")
        self.unit_menu = ctk.CTkOptionMenu(
            vol_frame,
            values=["m³", "tấn", "m", "m²", "cái"],
            variable=self.unit_var,
            width=80
        )
        self.unit_menu.pack(side="left", padx=(5, 0))
        
        price_frame = ctk.CTkFrame(container, fg_color="transparent")
        price_frame.pack(fill="x", pady=(0, 10))
        
        # Unit price
        ctk.CTkLabel(price_frame, text="Đơn giá:").pack(side="left")
        self.unit_price_entry = ctk.CTkEntry(price_frame, width=150)
        self.unit_price_entry.pack(side="left", padx=(5, 10))
        ctk.CTkLabel(price_frame, text="VNĐ").pack(side="left")
        
        # Total value (calculated)
        total_frame = ctk.CTkFrame(container, fg_color="transparent")
        total_frame.pack(fill="x", pady=(0, 10))
        
        ctk.CTkLabel(total_frame, text="Tổng giá trị:").pack(side="left")
        self.total_label = ctk.CTkLabel(total_frame, text="0 VNĐ", font=("Arial", 14, "bold"))
        self.total_label.pack(side="left", padx=(5, 0))
        
        # Bind to calculate total
        self.volume_entry.bind("<KeyRelease>", self._calculate_total)
        self.unit_price_entry.bind("<KeyRelease>", self._calculate_total)
        
        # === Status Section ===
        self._create_section_label(container, "📊 Trạng thái")
        
        status_frame = ctk.CTkFrame(container, fg_color="transparent")
        status_frame.pack(fill="x", pady=(0, 10))
        
        self.status_var = ctk.IntVar(value=0)
        
        statuses = [
            (0, "⬜ Chưa", "#9CA3AF"),
            (1, "🟨 Đang", "#FBBF24"),
            (2, "🟩 Xong", "#34D399")
        ]
        
        for value, text, color in statuses:
            rb = ctk.CTkRadioButton(
                status_frame,
                text=text,
                variable=self.status_var,
                value=value
            )
            rb.pack(side="left", padx=(0, 15))
        
        # Completed date
        date_frame = ctk.CTkFrame(container, fg_color="transparent")
        date_frame.pack(fill="x", pady=(0, 10))
        
        ctk.CTkLabel(date_frame, text="Ngày hoàn thành:").pack(side="left")
        self.completed_date_entry = ctk.CTkEntry(date_frame, width=120, placeholder_text="YYYY-MM-DD")
        self.completed_date_entry.pack(side="left", padx=(5, 0))
        
        # === Notes Section ===
        self._create_section_label(container, "📝 Ghi chú")
        
        self.notes_text = ctk.CTkTextbox(container, height=60)
        self.notes_text.pack(fill="x", pady=(0, 15))
        
        # === Buttons (outside scrollable) ===
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=15, pady=(0, 15))
        
        # Delete button (left)
        self.delete_btn = ctk.CTkButton(
            btn_frame,
            text="🗑️ Xóa",
            fg_color="#EF4444",
            hover_color="#DC2626",
            width=100,
            command=self._on_delete
        )
        self.delete_btn.pack(side="left")
        
        # Save and Cancel (right)
        self.cancel_btn = ctk.CTkButton(
            btn_frame,
            text="Hủy",
            fg_color="transparent",
            border_width=1,
            text_color=("gray10", "gray90"),
            width=100,
            command=self.destroy
        )
        self.cancel_btn.pack(side="right", padx=(10, 0))
        
        self.save_btn = ctk.CTkButton(
            btn_frame,
            text="💾 Lưu",
            width=100,
            command=self._on_save
        )
        self.save_btn.pack(side="right")
    
    def _create_section_label(self, parent, text: str):
        """Create a section label."""
        label = ctk.CTkLabel(
            parent,
            text=text,
            font=("Arial", 13, "bold")
        )
        label.pack(anchor="w", pady=(12, 5))
    
    def _create_field(self, parent, text: str):
        """Create a field label."""
        label = ctk.CTkLabel(parent, text=text)
        label.pack(anchor="w")
    
    def _load_data(self):
        """Load block data into form."""
        block = self.block
        
        self.code_entry.insert(0, block.get('code', ''))
        
        # Category
        cat_name = block.get('category_name', '')
        if cat_name:
            self.category_var.set(cat_name)
        
        # Coordinates
        self.coord_x_entry.insert(0, str(round(block.get('pos_x', 0), 1)))
        self.coord_y_entry.insert(0, str(round(block.get('pos_y', 0), 1)))
        self.width_entry.insert(0, str(round(block.get('width', 60), 1)))
        self.height_entry.insert(0, str(round(block.get('height', 40), 1)))
        
        # Position
        self.pier_entry.insert(0, block.get('pier', '') or '')
        self.span_entry.insert(0, block.get('span', '') or '')
        self.segment_entry.insert(0, block.get('segment', '') or '')
        
        # Volume & Price
        if block.get('volume') is not None:
            self.volume_entry.insert(0, str(block['volume']))
        if block.get('unit'):
            self.unit_var.set(block['unit'])
        if block.get('unit_price') is not None:
            self.unit_price_entry.insert(0, str(int(block['unit_price'])))
        
        # Status
        self.status_var.set(block.get('status', 0))
        
        # Completed date
        if block.get('completed_at'):
            self.completed_date_entry.insert(0, block['completed_at'])
        
        # Notes
        if block.get('notes'):
            self.notes_text.insert("1.0", block['notes'])
        
        # Calculate total
        self._calculate_total()
    
    def _calculate_total(self, event=None):
        """Calculate and display total value."""
        try:
            volume = float(self.volume_entry.get() or 0)
            unit_price = float(self.unit_price_entry.get() or 0)
            total = volume * unit_price
            self.total_label.configure(text=f"{total:,.0f} VNĐ")
        except ValueError:
            self.total_label.configure(text="0 VNĐ")
    
    def _get_form_data(self) -> Dict:
        """Get form data as dictionary."""
        # Get category_id
        category_id = None
        cat_name = self.category_var.get()
        for cat in self.categories:
            if cat['name'] == cat_name:
                category_id = cat['id']
                break
        
        # Parse numeric values
        def parse_float(val, default=0):
            try:
                return float(val) if val else default
            except ValueError:
                return default
        
        volume = parse_float(self.volume_entry.get(), None)
        unit_price = parse_float(self.unit_price_entry.get(), None)
        
        total_value = None
        if volume is not None and unit_price is not None:
            total_value = volume * unit_price
        
        return {
            'id': self.block['id'],
            'code': self.code_entry.get().strip(),
            'category_id': category_id,
            # Coordinates
            'pos_x': parse_float(self.coord_x_entry.get(), 0),
            'pos_y': parse_float(self.coord_y_entry.get(), 0),
            'width': parse_float(self.width_entry.get(), 60),
            'height': parse_float(self.height_entry.get(), 40),
            # Logical position
            'pier': self.pier_entry.get().strip() or None,
            'span': self.span_entry.get().strip() or None,
            'segment': self.segment_entry.get().strip() or None,
            # Values
            'volume': volume,
            'unit': self.unit_var.get(),
            'unit_price': unit_price,
            'total_value': total_value,
            'status': self.status_var.get(),
            'completed_at': self.completed_date_entry.get().strip() or None,
            'notes': self.notes_text.get("1.0", "end-1c").strip() or None
        }
    
    def _on_save(self):
        """Handle save button."""
        data = self._get_form_data()
        
        # Validate
        if not data['code']:
            messagebox.showerror("Lỗi", "Vui lòng nhập số hiệu block!")
            return
        
        if self.on_save:
            self.on_save(data)
        
        self.result = data
        self.destroy()
    
    def _on_delete(self):
        """Handle delete button."""
        if messagebox.askyesno(
            "Xác nhận xóa",
            f"Bạn có chắc muốn xóa block '{self.block.get('code', '')}'?"
        ):
            if self.on_delete:
                self.on_delete(self.block['id'])
            self.destroy()

"""
Shapes Panel - Contains user-defined block templates.
Supports drag and drop to canvas with block naming.
"""

import tkinter as tk
from tkinter import simpledialog
from typing import Dict, List, Callable, Optional
import customtkinter as ctk


SHAPE_RECT = "rect"
SHAPE_CIRCLE = "circle"


class ShapeTemplate:
    """A shape template defined by user."""
    def __init__(self, name: str, shape: str, width: float = 0, height: float = 0, diameter: float = 0):
        self.name = name
        self.shape = shape
        self.width = width
        self.height = height
        self.diameter = diameter
    
    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'shape': self.shape,
            'width': self.width,
            'height': self.height,
            'diameter': self.diameter
        }


class ShapeItem(ctk.CTkFrame):
    """A single shape item in the panel, can be dragged."""
    
    def __init__(
        self,
        master,
        template: ShapeTemplate,
        on_drag_start: Callable = None,
        on_delete: Callable = None,
        **kwargs
    ):
        super().__init__(master, **kwargs)
        self.template = template
        self.on_drag_start = on_drag_start
        self.on_delete = on_delete
        
        self.configure(
            fg_color="#1f2937",
            corner_radius=6,
            height=50
        )
        
        self._create_widgets()
        self._bind_drag()
    
    def _create_widgets(self):
        """Create item widgets."""
        # Preview canvas
        self.preview = tk.Canvas(
            self, width=40, height=40,
            bg="#1f2937", highlightthickness=0
        )
        self.preview.pack(side="left", padx=5, pady=5)
        
        # Draw shape preview
        if self.template.shape == SHAPE_CIRCLE:
            self.preview.create_oval(5, 5, 35, 35, fill="#3B82F6", outline="#60A5FA", width=2)
        else:
            self.preview.create_rectangle(5, 8, 35, 32, fill="#3B82F6", outline="#60A5FA", width=2)
        
        # Info frame
        info_frame = ctk.CTkFrame(self, fg_color="transparent")
        info_frame.pack(side="left", fill="both", expand=True, pady=3)
        
        # Name label
        ctk.CTkLabel(
            info_frame,
            text=self.template.name,
            font=("Arial", 11, "bold"),
            anchor="w"
        ).pack(fill="x")
        
        # Size label
        if self.template.shape == SHAPE_CIRCLE:
            size_text = f"Ø{int(self.template.diameter)}"
        else:
            size_text = f"{int(self.template.width)}×{int(self.template.height)}"
        
        ctk.CTkLabel(
            info_frame,
            text=size_text,
            font=("Arial", 9),
            text_color="#9CA3AF",
            anchor="w"
        ).pack(fill="x")
        
        # Delete button
        ctk.CTkButton(
            self,
            text="×",
            width=24,
            height=24,
            fg_color="#374151",
            hover_color="#EF4444",
            command=self._on_delete
        ).pack(side="right", padx=5)
    
    def _bind_drag(self):
        """Bind drag events."""
        self.bind("<Button-1>", self._start_drag)
        self.preview.bind("<Button-1>", self._start_drag)
        
        for child in self.winfo_children():
            child.bind("<Button-1>", self._start_drag)
    
    def _start_drag(self, event):
        """Start drag operation."""
        if self.on_drag_start:
            self.on_drag_start(self.template)
    
    def _on_delete(self):
        """Delete this template."""
        if self.on_delete:
            self.on_delete(self.template.name)


class ShapesPanel(ctk.CTkFrame):
    """Panel containing user-defined shape templates for drag-drop."""
    
    def __init__(
        self,
        master,
        on_drop_to_canvas: Callable = None,  # Called when dropped on canvas
        **kwargs
    ):
        super().__init__(master, **kwargs)
        
        self.on_drop_to_canvas = on_drop_to_canvas
        self.templates: List[ShapeTemplate] = []
        self.shape_items: Dict[str, ShapeItem] = {}
        
        # Drag state
        self.dragging_template: Optional[ShapeTemplate] = None
        self.drag_window = None
        
        self.configure(fg_color="#111827", corner_radius=8)
        self._create_widgets()
        self._load_default_templates()
    
    def _create_widgets(self):
        """Create panel widgets."""
        # Header
        header = ctk.CTkFrame(self, fg_color="#1f2937", corner_radius=8)
        header.pack(fill="x", padx=5, pady=5)
        
        ctk.CTkLabel(
            header,
            text="📦 Block Mẫu",
            font=("Arial", 12, "bold")
        ).pack(side="left", padx=10, pady=8)
        
        # Add buttons
        btn_frame = ctk.CTkFrame(header, fg_color="transparent")
        btn_frame.pack(side="right", padx=5)
        
        ctk.CTkButton(
            btn_frame,
            text="▭",
            width=28,
            height=28,
            fg_color="#3B82F6",
            command=self._add_rect_template
        ).pack(side="left", padx=2)
        
        ctk.CTkButton(
            btn_frame,
            text="⚪",
            width=28,
            height=28,
            fg_color="#10B981",
            command=self._add_circle_template
        ).pack(side="left", padx=2)
        
        # Scrollable container
        self.scroll_frame = ctk.CTkScrollableFrame(
            self,
            fg_color="transparent",
            height=200
        )
        self.scroll_frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Help text
        self.help_label = ctk.CTkLabel(
            self.scroll_frame,
            text="Kéo block mẫu vào canvas\n\n▭ Thêm HCN  ⚪ Thêm Tròn",
            font=("Arial", 10),
            text_color="#6B7280"
        )
        self.help_label.pack(pady=10)
    
    def _load_default_templates(self):
        """Load some default templates."""
        defaults = [
            ShapeTemplate("Dầm T", SHAPE_RECT, 100, 30),
            ShapeTemplate("Bản mặt cầu", SHAPE_RECT, 120, 20),
            ShapeTemplate("Bệ móng", SHAPE_RECT, 80, 50),
            ShapeTemplate("Cọc D600", SHAPE_CIRCLE, diameter=60),
            ShapeTemplate("Cọc D1000", SHAPE_CIRCLE, diameter=100),
        ]
        for t in defaults:
            self._add_template(t)
    
    def _add_template(self, template: ShapeTemplate):
        """Add a template to the panel."""
        if template.name in self.shape_items:
            return
        
        self.help_label.pack_forget()
        
        self.templates.append(template)
        item = ShapeItem(
            self.scroll_frame,
            template,
            on_drag_start=self._on_item_drag_start,
            on_delete=self._on_item_delete
        )
        item.pack(fill="x", pady=2)
        self.shape_items[template.name] = item
    
    def _add_rect_template(self):
        """Add a new rectangle template."""
        # Ask for name
        name = simpledialog.askstring("Tên Block", "Nhập tên block mẫu:", parent=self)
        if not name:
            return
        
        # Ask for width
        width = simpledialog.askfloat("Chiều rộng", "Nhập chiều rộng (m):", parent=self, minvalue=10, maxvalue=500)
        if not width:
            return
        
        # Ask for height
        height = simpledialog.askfloat("Chiều cao", "Nhập chiều cao (m):", parent=self, minvalue=5, maxvalue=300)
        if not height:
            return
        
        template = ShapeTemplate(name, SHAPE_RECT, width=width, height=height)
        self._add_template(template)
    
    def _add_circle_template(self):
        """Add a new circle template."""
        name = simpledialog.askstring("Tên Block", "Nhập tên block mẫu:", parent=self)
        if not name:
            return
        
        diameter = simpledialog.askfloat("Đường kính", "Nhập đường kính (mm):", parent=self, minvalue=100, maxvalue=5000)
        if not diameter:
            return
        
        template = ShapeTemplate(name, SHAPE_CIRCLE, diameter=diameter)
        self._add_template(template)
    
    def _on_item_drag_start(self, template: ShapeTemplate):
        """Handle drag start from an item."""
        self.dragging_template = template
        
        # Create floating drag window
        self.drag_window = tk.Toplevel(self)
        self.drag_window.overrideredirect(True)
        self.drag_window.attributes("-alpha", 0.8)
        self.drag_window.attributes("-topmost", True)
        
        # Create preview canvas in drag window
        preview = tk.Canvas(self.drag_window, width=60, height=60, bg="#1f2937", highlightthickness=1, highlightbackground="#3B82F6")
        preview.pack()
        
        if template.shape == SHAPE_CIRCLE:
            preview.create_oval(5, 5, 55, 55, fill="#3B82F6", outline="#60A5FA", width=2)
        else:
            preview.create_rectangle(5, 10, 55, 50, fill="#3B82F6", outline="#60A5FA", width=2)
        
        preview.create_text(30, 30, text=template.name[:6], fill="white", font=("Arial", 9, "bold"))
        
        # Bind motion and release to root window
        root = self.winfo_toplevel()
        root.bind("<Motion>", self._on_drag_motion)
        root.bind("<ButtonRelease-1>", self._on_drag_release)
        
        # Position at cursor
        x, y = root.winfo_pointerxy()
        self.drag_window.geometry(f"+{x-30}+{y-30}")
    
    def _on_drag_motion(self, event):
        """Update drag window position."""
        if self.drag_window:
            self.drag_window.geometry(f"+{event.x_root-30}+{event.y_root-30}")
    
    def _on_drag_release(self, event):
        """Handle drag release - check if over canvas."""
        root = self.winfo_toplevel()
        root.unbind("<Motion>")
        root.unbind("<ButtonRelease-1>")
        
        if self.drag_window:
            self.drag_window.destroy()
            self.drag_window = None
        
        if not self.dragging_template:
            return
        
        template = self.dragging_template
        self.dragging_template = None
        
        # Check if dropped on canvas
        if self.on_drop_to_canvas:
            # Get widget under cursor
            x, y = event.x_root, event.y_root
            widget = root.winfo_containing(x, y)
            
            # Check if it's the canvas
            canvas = self._find_canvas(widget)
            if canvas:
                # Convert to canvas coordinates
                canvas_x = x - canvas.winfo_rootx()
                canvas_y = y - canvas.winfo_rooty()
                
                # Ask for block name
                block_name = simpledialog.askstring(
                    "Tên Block",
                    f"Nhập tên cho block ({template.name}):",
                    parent=self,
                    initialvalue=template.name
                )
                
                if block_name:
                    self.on_drop_to_canvas(canvas, canvas_x, canvas_y, template.to_dict(), block_name)
    
    def _find_canvas(self, widget) -> Optional[tk.Canvas]:
        """Find canvas widget in hierarchy."""
        while widget:
            if isinstance(widget, tk.Canvas):
                return widget
            try:
                widget = widget.master
            except:
                break
        return None
    
    def _on_item_delete(self, name: str):
        """Delete a template."""
        if name in self.shape_items:
            self.shape_items[name].destroy()
            del self.shape_items[name]
            self.templates = [t for t in self.templates if t.name != name]
        
        if not self.shape_items:
            self.help_label.pack(pady=10)

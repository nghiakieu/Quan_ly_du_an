"""
Data Panel - Block list and quick actions.
"""

import customtkinter as ctk
from tkinter import ttk
from typing import Dict, List, Optional, Callable


class DataPanel(ctk.CTkFrame):
    """Panel showing block list with filtering and quick actions."""
    
    def __init__(
        self,
        master,
        on_block_select: Callable[[int], None] = None,
        on_add_block: Callable[[], None] = None,
        **kwargs
    ):
        super().__init__(master, **kwargs)
        
        self.on_block_select = on_block_select
        self.on_add_block = on_add_block
        self.blocks: List[Dict] = []
        
        self._create_widgets()
    
    def _create_widgets(self):
        """Create panel widgets."""
        # Header
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(
            header,
            text="📋 Danh sách Block",
            font=("Arial", 14, "bold")
        ).pack(side="left")
        
        self.add_btn = ctk.CTkButton(
            header,
            text="➕",
            width=30,
            command=self._on_add_click
        )
        self.add_btn.pack(side="right")
        
        # Search
        self.search_entry = ctk.CTkEntry(
            self,
            placeholder_text="🔍 Tìm kiếm...",
            width=250
        )
        self.search_entry.pack(fill="x", padx=10, pady=(0, 10))
        self.search_entry.bind("<KeyRelease>", self._on_search)
        
        # Filter by status
        filter_frame = ctk.CTkFrame(self, fg_color="transparent")
        filter_frame.pack(fill="x", padx=10, pady=(0, 10))
        
        self.filter_var = ctk.StringVar(value="Tất cả")
        filters = ["Tất cả", "Chưa", "Đang", "Xong"]
        
        for f in filters:
            rb = ctk.CTkRadioButton(
                filter_frame,
                text=f,
                variable=self.filter_var,
                value=f,
                command=self._apply_filter
            )
            rb.pack(side="left", padx=5)
        
        # Block list using Treeview
        list_frame = ctk.CTkFrame(self)
        list_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        # Style for Treeview
        style = ttk.Style()
        style.configure("Treeview", rowheight=30)
        
        columns = ("code", "category", "status", "value")
        self.tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=15)
        
        self.tree.heading("code", text="Số hiệu")
        self.tree.heading("category", text="Hạng mục")
        self.tree.heading("status", text="TT")
        self.tree.heading("value", text="Giá trị")
        
        self.tree.column("code", width=80)
        self.tree.column("category", width=100)
        self.tree.column("status", width=40, anchor="center")
        self.tree.column("value", width=80, anchor="e")
        
        self.tree.pack(side="left", fill="both", expand=True)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        scrollbar.pack(side="right", fill="y")
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        # Bind selection
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)
    
    def load_blocks(self, blocks: List[Dict]):
        """Load blocks into the list."""
        self.blocks = blocks
        self._refresh_tree()
    
    def _refresh_tree(self):
        """Refresh tree view with current blocks and filters."""
        # Clear current items
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # Get filter
        status_filter = self.filter_var.get()
        search_text = self.search_entry.get().lower()
        
        status_map = {"Chưa": 0, "Đang": 1, "Xong": 2}
        status_icons = {0: "⬜", 1: "🟨", 2: "🟩"}
        
        for block in self.blocks:
            # Apply status filter
            if status_filter != "Tất cả":
                if block.get('status', 0) != status_map.get(status_filter, -1):
                    continue
            
            # Apply search filter
            if search_text:
                code = block.get('code', '').lower()
                category = block.get('category_name', '').lower()
                if search_text not in code and search_text not in category:
                    continue
            
            # Add to tree
            status_icon = status_icons.get(block.get('status', 0), "⬜")
            value = block.get('total_value')
            value_str = f"{value:,.0f}" if value else ""
            
            self.tree.insert(
                "",
                "end",
                iid=str(block['id']),
                values=(
                    block.get('code', ''),
                    block.get('category_name', ''),
                    status_icon,
                    value_str
                )
            )
    
    def _apply_filter(self):
        """Apply current filter settings."""
        self._refresh_tree()
    
    def _on_search(self, event=None):
        """Handle search input."""
        self._refresh_tree()
    
    def _on_tree_select(self, event):
        """Handle tree selection."""
        selection = self.tree.selection()
        if selection and self.on_block_select:
            block_id = int(selection[0])
            self.on_block_select(block_id)
    
    def _on_tree_double_click(self, event):
        """Handle double click on tree item."""
        # Same as select for now
        pass
    
    def _on_add_click(self):
        """Handle add button click."""
        if self.on_add_block:
            self.on_add_block()
    
    def update_block(self, block_id: int, data: Dict):
        """Update a single block in the list."""
        for i, block in enumerate(self.blocks):
            if block['id'] == block_id:
                self.blocks[i].update(data)
                break
        self._refresh_tree()
    
    def select_block(self, block_id: int):
        """Select a block in the tree."""
        self.tree.selection_set(str(block_id))
        self.tree.see(str(block_id))

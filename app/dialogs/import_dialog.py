"""
Import Dialog - Excel import with diff preview and confirm/cancel.
"""

import customtkinter as ctk
from tkinter import ttk, messagebox
from typing import Dict, List, Callable


class ImportDialog(ctk.CTkToplevel):
    """Dialog for importing Excel with change preview and confirmation."""
    
    def __init__(
        self,
        master,
        diff_result: Dict[str, List],
        on_confirm: Callable[[], None] = None,
        **kwargs
    ):
        super().__init__(master, **kwargs)
        
        self.diff_result = diff_result
        self.on_confirm = on_confirm
        self.confirmed = False
        
        # Window setup
        self.title("📥 Import Excel - Xem trước thay đổi")
        self.geometry("750x550")
        self.resizable(True, True)
        
        # Make modal
        self.transient(master)
        self.grab_set()
        
        self._create_widgets()
        self._load_diff()
        
        # Center on parent
        self.update_idletasks()
        x = master.winfo_x() + (master.winfo_width() - 750) // 2
        y = master.winfo_y() + (master.winfo_height() - 550) // 2
        self.geometry(f"+{max(0, x)}+{max(0, y)}")
        
        # Focus on this window
        self.focus_force()
    
    def _create_widgets(self):
        """Create dialog widgets."""
        # Main container
        main_container = ctk.CTkFrame(self, fg_color="transparent")
        main_container.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Summary header
        summary_frame = ctk.CTkFrame(main_container)
        summary_frame.pack(fill="x", pady=(0, 15))
        
        new_count = len(self.diff_result.get('new', []))
        changed_count = len(self.diff_result.get('changed', []))
        deleted_count = len(self.diff_result.get('deleted', []))
        
        ctk.CTkLabel(
            summary_frame,
            text="📊 Tóm tắt thay đổi",
            font=("Arial", 18, "bold")
        ).pack(anchor="w", padx=15, pady=(15, 10))
        
        # Stats in one row
        stats_frame = ctk.CTkFrame(summary_frame, fg_color="transparent")
        stats_frame.pack(fill="x", padx=15, pady=(0, 15))
        
        # New blocks card
        new_card = ctk.CTkFrame(stats_frame, fg_color="#065F46")
        new_card.pack(side="left", padx=(0, 10), fill="x", expand=True)
        ctk.CTkLabel(new_card, text=f"🆕 {new_count}", font=("Arial", 20, "bold")).pack(pady=5)
        ctk.CTkLabel(new_card, text="Blocks mới", font=("Arial", 11)).pack(pady=(0, 5))
        
        # Changed blocks card
        changed_card = ctk.CTkFrame(stats_frame, fg_color="#92400E")
        changed_card.pack(side="left", padx=(0, 10), fill="x", expand=True)
        ctk.CTkLabel(changed_card, text=f"✏️ {changed_count}", font=("Arial", 20, "bold")).pack(pady=5)
        ctk.CTkLabel(changed_card, text="Thay đổi", font=("Arial", 11)).pack(pady=(0, 5))
        
        # Deleted blocks card
        deleted_card = ctk.CTkFrame(stats_frame, fg_color="#991B1B")
        deleted_card.pack(side="left", fill="x", expand=True)
        ctk.CTkLabel(deleted_card, text=f"🗑️ {deleted_count}", font=("Arial", 20, "bold")).pack(pady=5)
        ctk.CTkLabel(deleted_card, text="Blocks xóa", font=("Arial", 11)).pack(pady=(0, 5))
        
        # Tab view for details
        self.tabview = ctk.CTkTabview(main_container, height=280)
        self.tabview.pack(fill="both", expand=True, pady=(0, 15))
        
        self.tab_new = self.tabview.add(f"🆕 Mới ({new_count})")
        self.tab_changed = self.tabview.add(f"✏️ Thay đổi ({changed_count})")
        self.tab_deleted = self.tabview.add(f"🗑️ Xóa ({deleted_count})")
        
        # Create trees for each tab
        self.tree_new = self._create_tree(
            self.tab_new, 
            [("code", "Số hiệu", 100), ("category", "Hạng mục", 150), ("pier", "Trụ", 60), ("volume", "Khối lượng", 100)]
        )
        self.tree_changed = self._create_tree(
            self.tab_changed, 
            [("code", "Số hiệu", 100), ("changes", "Các field thay đổi", 400)]
        )
        self.tree_deleted = self._create_tree(
            self.tab_deleted, 
            [("code", "Số hiệu", 100), ("category", "Hạng mục", 150)]
        )
        
        # ===== BUTTONS FRAME =====
        btn_frame = ctk.CTkFrame(main_container, fg_color="transparent")
        btn_frame.pack(fill="x", pady=(10, 0))
        
        # Note text
        note_label = ctk.CTkLabel(
            btn_frame,
            text="⚠️ Lưu ý: Blocks bị xóa trong Excel sẽ KHÔNG tự động xóa trong app.",
            text_color="#F59E0B",
            font=("Arial", 11)
        )
        note_label.pack(side="left")
        
        # Cancel button
        self.cancel_btn = ctk.CTkButton(
            btn_frame,
            text="❌ Hủy bỏ",
            fg_color="#6B7280",
            hover_color="#4B5563",
            width=120,
            height=40,
            font=("Arial", 13, "bold"),
            command=self._on_cancel
        )
        self.cancel_btn.pack(side="right", padx=(10, 0))
        
        # Confirm button
        self.confirm_btn = ctk.CTkButton(
            btn_frame,
            text="✅ Xác nhận Import",
            fg_color="#059669",
            hover_color="#047857",
            width=160,
            height=40,
            font=("Arial", 13, "bold"),
            command=self._on_confirm
        )
        self.confirm_btn.pack(side="right")
    
    def _create_tree(self, parent, columns: List[tuple]) -> ttk.Treeview:
        """Create a tree view for the tab."""
        tree_frame = ctk.CTkFrame(parent, fg_color="transparent")
        tree_frame.pack(fill="both", expand=True, pady=5)
        
        col_ids = [c[0] for c in columns]
        tree = ttk.Treeview(tree_frame, columns=col_ids, show="headings", height=8)
        
        for col_id, col_name, col_width in columns:
            tree.heading(col_id, text=col_name)
            tree.column(col_id, width=col_width)
        
        tree.pack(side="left", fill="both", expand=True)
        
        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        scrollbar.pack(side="right", fill="y")
        tree.configure(yscrollcommand=scrollbar.set)
        
        return tree
    
    def _load_diff(self):
        """Load diff data into trees."""
        # New blocks
        for block in self.diff_result.get('new', []):
            self.tree_new.insert(
                "", "end",
                values=(
                    block.get('code', ''),
                    block.get('category_name', ''),
                    block.get('pier', ''),
                    f"{block.get('volume', 0) or 0:.2f}"
                )
            )
        
        # Changed blocks
        for excel_block, db_block, changed_fields in self.diff_result.get('changed', []):
            changes_str = ", ".join(changed_fields)
            self.tree_changed.insert(
                "", "end",
                values=(
                    excel_block.get('code', ''),
                    changes_str
                )
            )
        
        # Deleted blocks
        for block in self.diff_result.get('deleted', []):
            self.tree_deleted.insert(
                "", "end",
                values=(
                    block.get('code', ''),
                    block.get('category_name', '')
                )
            )
    
    def _on_confirm(self):
        """Handle confirm button - apply import."""
        self.confirmed = True
        if self.on_confirm:
            self.on_confirm()
        self.destroy()
    
    def _on_cancel(self):
        """Handle cancel button - close without applying."""
        self.confirmed = False
        self.destroy()


def show_import_dialog(parent, diff_result: Dict) -> bool:
    """
    Show import dialog and return True if confirmed.
    """
    dialog = ImportDialog(parent, diff_result)
    parent.wait_window(dialog)
    return dialog.confirmed

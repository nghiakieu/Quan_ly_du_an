"""
Dashboard Panel - Statistics and overview display.
"""

import customtkinter as ctk
from typing import Dict, Optional


class DashboardPanel(ctk.CTkFrame):
    """Panel showing project statistics and progress."""
    
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        
        self.stats: Dict = {}
        self._create_widgets()
    
    def _create_widgets(self):
        """Create dashboard widgets."""
        # Title
        title = ctk.CTkLabel(
            self,
            text="📊 Dashboard",
            font=("Arial", 18, "bold")
        )
        title.pack(pady=(10, 20))
        
        # Progress section
        progress_frame = ctk.CTkFrame(self)
        progress_frame.pack(fill="x", padx=10, pady=5)
        
        ctk.CTkLabel(
            progress_frame,
            text="Tiến độ tổng thể",
            font=("Arial", 12)
        ).pack(anchor="w", padx=10, pady=(10, 5))
        
        self.progress_bar = ctk.CTkProgressBar(progress_frame, width=250)
        self.progress_bar.pack(padx=10, pady=5)
        self.progress_bar.set(0)
        
        self.progress_label = ctk.CTkLabel(
            progress_frame,
            text="0%",
            font=("Arial", 24, "bold")
        )
        self.progress_label.pack(pady=(5, 10))
        
        # Stats cards
        cards_frame = ctk.CTkFrame(self, fg_color="transparent")
        cards_frame.pack(fill="x", padx=10, pady=10)
        
        # Block counts
        self.card_total = self._create_stat_card(cards_frame, "📦 Tổng blocks", "0")
        self.card_total.pack(fill="x", pady=5)
        
        self.card_not_started = self._create_stat_card(cards_frame, "⬜ Chưa thi công", "0", "#9CA3AF")
        self.card_not_started.pack(fill="x", pady=5)
        
        self.card_in_progress = self._create_stat_card(cards_frame, "🟨 Đang thi công", "0", "#FBBF24")
        self.card_in_progress.pack(fill="x", pady=5)
        
        self.card_completed = self._create_stat_card(cards_frame, "🟩 Hoàn thành", "0", "#34D399")
        self.card_completed.pack(fill="x", pady=5)
        
        # Value section
        value_frame = ctk.CTkFrame(self)
        value_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(
            value_frame,
            text="💰 Giá trị",
            font=("Arial", 14, "bold")
        ).pack(anchor="w", padx=10, pady=(10, 5))
        
        # Total value
        total_row = ctk.CTkFrame(value_frame, fg_color="transparent")
        total_row.pack(fill="x", padx=10, pady=2)
        ctk.CTkLabel(total_row, text="Tổng giá trị:").pack(side="left")
        self.total_value_label = ctk.CTkLabel(total_row, text="0 VNĐ", font=("Arial", 12, "bold"))
        self.total_value_label.pack(side="right")
        
        # Completed value
        completed_row = ctk.CTkFrame(value_frame, fg_color="transparent")
        completed_row.pack(fill="x", padx=10, pady=2)
        ctk.CTkLabel(completed_row, text="Đã thực hiện:").pack(side="left")
        self.completed_value_label = ctk.CTkLabel(completed_row, text="0 VNĐ", font=("Arial", 12, "bold"), text_color="#34D399")
        self.completed_value_label.pack(side="right")
        
        # Value progress bar
        self.value_progress = ctk.CTkProgressBar(value_frame, width=250, progress_color="#34D399")
        self.value_progress.pack(padx=10, pady=(10, 10))
        self.value_progress.set(0)
    
    def _create_stat_card(self, parent, title: str, value: str, color: str = None) -> ctk.CTkFrame:
        """Create a statistics card."""
        card = ctk.CTkFrame(parent)
        
        title_label = ctk.CTkLabel(card, text=title, font=("Arial", 11))
        title_label.pack(side="left", padx=10, pady=8)
        
        value_label = ctk.CTkLabel(
            card,
            text=value,
            font=("Arial", 16, "bold"),
            text_color=color
        )
        value_label.pack(side="right", padx=10, pady=8)
        
        # Store reference to value label for updates
        card.value_label = value_label
        
        return card
    
    def update_stats(self, stats: Dict):
        """Update dashboard with new statistics."""
        self.stats = stats
        
        # Progress
        progress = stats.get('progress_percent', 0) / 100
        self.progress_bar.set(progress)
        self.progress_label.configure(text=f"{stats.get('progress_percent', 0):.1f}%")
        
        # Block counts
        self.card_total.value_label.configure(text=str(stats.get('total_blocks', 0)))
        self.card_not_started.value_label.configure(text=str(stats.get('not_started', 0)))
        self.card_in_progress.value_label.configure(text=str(stats.get('in_progress', 0)))
        self.card_completed.value_label.configure(text=str(stats.get('completed', 0)))
        
        # Values
        total_value = stats.get('total_value', 0)
        completed_value = stats.get('completed_value', 0)
        
        self.total_value_label.configure(text=f"{total_value:,.0f} VNĐ")
        self.completed_value_label.configure(text=f"{completed_value:,.0f} VNĐ")
        
        # Value progress
        if total_value > 0:
            self.value_progress.set(completed_value / total_value)
        else:
            self.value_progress.set(0)

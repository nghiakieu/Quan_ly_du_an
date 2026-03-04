"""
Block Canvas - Visualization with rectangle and circle blocks.
Features: drawing, drag-drop from shapes panel, multi-select, pan/zoom.
Fixed: pan works in all directions, grid covers entire canvas.
"""

import tkinter as tk
from tkinter import Canvas, simpledialog
from typing import Dict, List, Optional, Callable, Tuple, Set
import customtkinter as ctk

# Status colors
STATUS_COLORS = {
    0: "#6B7280",  # Not started - Gray
    1: "#F59E0B",  # In progress - Yellow/Orange
    2: "#10B981",  # Completed - Green
}

SHAPE_RECT = "rect"
SHAPE_CIRCLE = "circle"


class BlockCanvas(ctk.CTkFrame):
    """Canvas with bottom-left origin for block visualization."""
    
    MODE_SELECT = "select"
    MODE_DRAW_RECT = "draw_rect"
    MODE_DRAW_CIRCLE = "draw_circle"
    
    def __init__(
        self,
        master,
        on_block_status_change: Callable = None,
        on_block_right_click: Callable = None,
        on_block_move: Callable = None,
        on_block_created: Callable = None,
        on_blocks_delete: Callable = None,
        **kwargs
    ):
        super().__init__(master, **kwargs)
        
        self.on_block_status_change = on_block_status_change
        self.on_block_right_click = on_block_right_click
        self.on_block_move = on_block_move
        self.on_block_created = on_block_created
        self.on_blocks_delete = on_blocks_delete
        
        # Data
        self.blocks: Dict[int, Dict] = {}
        self.block_items: Dict[int, int] = {}
        self.block_labels: Dict[int, int] = {}
        self.item_to_block: Dict[int, int] = {}
        self.selected_blocks: Set[int] = set()
        
        # View state - offset from canvas origin to world origin (0,0)
        self.scale = 1.0
        self.offset_x = 80.0  # World origin is 80px from left
        self.offset_y = 80.0  # World origin is 80px from bottom
        
        # Mode
        self.mode = self.MODE_SELECT
        self.current_shape = SHAPE_RECT
        
        # Drag state
        self.dragging = False
        self.drag_block_id = None
        self.drag_start_x = 0
        self.drag_start_y = 0
        
        # Pan state
        self.is_panning = False
        self.pan_start_x = 0
        self.pan_start_y = 0
        
        # Drawing state
        self.drawing = False
        self.draw_start_x = 0
        self.draw_start_y = 0
        self.draw_preview = None
        
        # Selection state
        self.selecting = False
        self.select_start_x = 0
        self.select_start_y = 0
        self.select_rect = None
        
        # Tooltip
        self.coord_tooltip = None
        
        # Drop preview
        self.drop_preview = None
        self.pending_drop = None
        
        self._create_canvas()
        self._bind_events()
    
    def _create_canvas(self):
        """Create the main canvas."""
        self.canvas = Canvas(
            self,
            bg="#0f172a",
            highlightthickness=0,
            cursor="hand2"
        )
        self.canvas.pack(fill="both", expand=True)
        self.after(100, self._draw_grid)
    
    def _draw_grid(self):
        """Draw background grid covering entire canvas."""
        self.canvas.delete("grid")
        
        cw = self.canvas.winfo_width() or 1400
        ch = self.canvas.winfo_height() or 800
        
        # Grid spacing in world units
        base_grid = 50
        grid_world = base_grid
        
        # Adjust grid density based on zoom
        grid_screen = grid_world * self.scale
        while grid_screen < 20:
            grid_world *= 2
            grid_screen = grid_world * self.scale
        while grid_screen > 100:
            grid_world /= 2
            grid_screen = grid_world * self.scale
        
        # Calculate grid start in world coordinates
        # Screen (0,0) -> World coordinates
        world_left = -self.offset_x / self.scale
        world_right = (cw - self.offset_x) / self.scale
        world_bottom = -self.offset_y / self.scale
        world_top = (ch - self.offset_y) / self.scale
        
        # Snap to grid
        start_x = int(world_left / grid_world) * grid_world
        start_y = int(world_bottom / grid_world) * grid_world
        
        # Draw vertical lines
        wx = start_x
        while wx <= world_right:
            sx = self._world_x_to_screen(wx)
            if 0 <= sx <= cw:
                self.canvas.create_line(sx, 0, sx, ch, fill="#1e293b", tags="grid")
            wx += grid_world
        
        # Draw horizontal lines
        wy = start_y
        while wy <= world_top:
            sy = self._world_y_to_screen(wy)
            if 0 <= sy <= ch:
                self.canvas.create_line(0, sy, cw, sy, fill="#1e293b", tags="grid")
            wy += grid_world
        
        self.canvas.tag_lower("grid")
    
    def _world_x_to_screen(self, wx: float) -> int:
        """Convert world X to screen X."""
        return int(wx * self.scale + self.offset_x)
    
    def _world_y_to_screen(self, wy: float) -> int:
        """Convert world Y to screen Y (Y up in world, Y down in screen)."""
        ch = self.canvas.winfo_height() or 800
        return int(ch - (wy * self.scale + self.offset_y))
    
    def _screen_to_world(self, sx: int, sy: int) -> Tuple[float, float]:
        """Convert screen to world coordinates."""
        ch = self.canvas.winfo_height() or 800
        wx = (sx - self.offset_x) / self.scale
        wy = (ch - sy - self.offset_y) / self.scale
        return max(0, wx), max(0, wy)
    
    def _world_to_screen(self, wx: float, wy: float) -> Tuple[int, int]:
        """Convert world to screen coordinates."""
        return self._world_x_to_screen(wx), self._world_y_to_screen(wy)
    
    def _bind_events(self):
        """Bind mouse and keyboard events."""
        self.canvas.bind("<Button-1>", self._on_left_click)
        self.canvas.bind("<B1-Motion>", self._on_left_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_left_release)
        
        self.canvas.bind("<Button-3>", self._on_right_click)
        
        # Middle mouse for panning
        self.canvas.bind("<Button-2>", self._on_pan_start)
        self.canvas.bind("<B2-Motion>", self._on_pan)
        self.canvas.bind("<ButtonRelease-2>", self._on_pan_end)
        
        self.canvas.bind("<MouseWheel>", self._on_scroll)
        self.canvas.bind("<Double-Button-1>", self._on_double_click)
        self.canvas.bind("<Configure>", self._on_resize)
        self.canvas.bind("<Motion>", self._on_mouse_move)
        
        # Keyboard
        self.canvas.bind("<Delete>", self._on_delete_key)
        self.canvas.bind("<BackSpace>", self._on_delete_key)
        self.canvas.bind("<Escape>", self._on_escape)
        
        self.canvas.focus_set()
        self.canvas.bind("<Button-1>", lambda e: self.canvas.focus_set(), add="+")
    
    def set_mode(self, mode: str):
        """Set interaction mode."""
        self.mode = mode
        if mode == self.MODE_DRAW_RECT:
            self.canvas.configure(cursor="crosshair")
            self.current_shape = SHAPE_RECT
        elif mode == self.MODE_DRAW_CIRCLE:
            self.canvas.configure(cursor="crosshair")
            self.current_shape = SHAPE_CIRCLE
        else:
            self.canvas.configure(cursor="hand2")
    
    def _get_block_at(self, x: int, y: int) -> Optional[int]:
        """Get block ID at screen position."""
        items = self.canvas.find_overlapping(x-2, y-2, x+2, y+2)
        for item in items:
            if item in self.item_to_block:
                return self.item_to_block[item]
        return None
    
    def _get_blocks_in_rect(self, x1: int, y1: int, x2: int, y2: int) -> Set[int]:
        """Get block IDs within screen rectangle."""
        items = self.canvas.find_enclosed(min(x1,x2), min(y1,y2), max(x1,x2), max(y1,y2))
        return {self.item_to_block[i] for i in items if i in self.item_to_block}
    
    def _on_mouse_move(self, event):
        """Show coordinates on hover."""
        if self.coord_tooltip:
            self.canvas.delete(self.coord_tooltip)
            self.coord_tooltip = None
        
        block_id = self._get_block_at(event.x, event.y)
        if block_id and block_id in self.blocks:
            block = self.blocks[block_id]
            x, y = round(block.get('pos_x', 0)), round(block.get('pos_y', 0))
            shape = block.get('shape', SHAPE_RECT)
            
            if shape == SHAPE_CIRCLE:
                info = f"⚪ ({x}, {y}) Ø{round(block.get('diameter', 50))}"
            else:
                info = f"▭ ({x}, {y}) {round(block.get('width', 60))}×{round(block.get('height', 40))}"
            
            self.coord_tooltip = self.canvas.create_text(
                event.x + 15, event.y - 15,
                text=info, fill="#FBBF24", font=("Arial", 9, "bold"), anchor="w"
            )
        else:
            wx, wy = self._screen_to_world(event.x, event.y)
            self.coord_tooltip = self.canvas.create_text(
                event.x + 10, event.y - 10,
                text=f"({int(wx)}, {int(wy)})", fill="#475569", font=("Arial", 9), anchor="w"
            )
    
    def _on_left_click(self, event):
        """Handle left click."""
        self.canvas.focus_set()
        
        if self.mode in [self.MODE_DRAW_RECT, self.MODE_DRAW_CIRCLE]:
            self.drawing = True
            self.draw_start_x = event.x
            self.draw_start_y = event.y
        else:
            block_id = self._get_block_at(event.x, event.y)
            if block_id:
                if event.state & 0x0004:  # Ctrl
                    if block_id in self.selected_blocks:
                        self._deselect_block(block_id)
                    else:
                        self._select_block(block_id)
                else:
                    self.drag_block_id = block_id
                    self.drag_start_x = event.x
                    self.drag_start_y = event.y
                    self.dragging = False
                    if block_id not in self.selected_blocks:
                        self._clear_selection()
                        self._select_block(block_id)
            else:
                self._clear_selection()
                self.selecting = True
                self.select_start_x = event.x
                self.select_start_y = event.y
    
    def _on_left_drag(self, event):
        """Handle left drag."""
        if self.mode in [self.MODE_DRAW_RECT, self.MODE_DRAW_CIRCLE] and self.drawing:
            self._update_draw_preview(event.x, event.y)
        elif self.selecting:
            self._update_selection_rect(event.x, event.y)
        elif self.drag_block_id:
            dx, dy = abs(event.x - self.drag_start_x), abs(event.y - self.drag_start_y)
            if dx > 5 or dy > 5:
                self.dragging = True
                move_x = (event.x - self.drag_start_x) / self.scale
                move_y = -(event.y - self.drag_start_y) / self.scale
                
                for bid in self.selected_blocks:
                    block = self.blocks.get(bid)
                    if block:
                        block['pos_x'] = max(0, block['pos_x'] + move_x)
                        block['pos_y'] = max(0, block['pos_y'] + move_y)
                        self._update_block_visual(bid)
                
                self.drag_start_x = event.x
                self.drag_start_y = event.y
    
    def _on_left_release(self, event):
        """Handle left release."""
        if self.mode in [self.MODE_DRAW_RECT, self.MODE_DRAW_CIRCLE] and self.drawing:
            self._finish_drawing(event.x, event.y)
        elif self.selecting:
            self._finish_selection(event.x, event.y)
        elif self.drag_block_id:
            if self.dragging:
                for bid in self.selected_blocks:
                    block = self.blocks.get(bid)
                    if block and self.on_block_move:
                        self.on_block_move(bid, block['pos_x'], block['pos_y'])
            else:
                self._toggle_block_status(self.drag_block_id)
            self.drag_block_id = None
            self.dragging = False
    
    def _update_draw_preview(self, x: int, y: int):
        """Update drawing preview."""
        if self.draw_preview:
            self.canvas.delete(self.draw_preview)
        
        x1, y1 = min(self.draw_start_x, x), min(self.draw_start_y, y)
        x2, y2 = max(self.draw_start_x, x), max(self.draw_start_y, y)
        
        if self.current_shape == SHAPE_CIRCLE:
            cx = (self.draw_start_x + x) / 2
            cy = (self.draw_start_y + y) / 2
            r = min(abs(x - self.draw_start_x), abs(y - self.draw_start_y)) / 2
            self.draw_preview = self.canvas.create_oval(
                cx - r, cy - r, cx + r, cy + r,
                fill="#3B82F6", outline="#60A5FA", width=2, stipple="gray50"
            )
        else:
            self.draw_preview = self.canvas.create_rectangle(
                x1, y1, x2, y2,
                fill="#3B82F6", outline="#60A5FA", width=2, stipple="gray50"
            )
    
    def _finish_drawing(self, x: int, y: int):
        """Finish drawing block."""
        self.drawing = False
        if self.draw_preview:
            self.canvas.delete(self.draw_preview)
            self.draw_preview = None
        
        x1, y1 = min(self.draw_start_x, x), min(self.draw_start_y, y)
        x2, y2 = max(self.draw_start_x, x), max(self.draw_start_y, y)
        
        if self.current_shape == SHAPE_CIRCLE:
            diameter = min(abs(x2 - x1), abs(y2 - y1)) / self.scale
            if diameter < 15:
                return
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            wx, wy = self._screen_to_world(int(cx), int(cy))
            if self.on_block_created:
                self.on_block_created(wx, wy, diameter, 0, SHAPE_CIRCLE)
        else:
            wx1, wy1 = self._screen_to_world(x1, y2)
            wx2, wy2 = self._screen_to_world(x2, y1)
            width, height = abs(wx2 - wx1), abs(wy2 - wy1)
            if width < 15 or height < 10:
                return
            if self.on_block_created:
                self.on_block_created(min(wx1, wx2), min(wy1, wy2), width, height, SHAPE_RECT)
    
    def _update_selection_rect(self, x: int, y: int):
        if self.select_rect:
            self.canvas.delete(self.select_rect)
        self.select_rect = self.canvas.create_rectangle(
            self.select_start_x, self.select_start_y, x, y,
            fill="", outline="#60A5FA", width=2, dash=(4, 4)
        )
    
    def _finish_selection(self, x: int, y: int):
        self.selecting = False
        if self.select_rect:
            self.canvas.delete(self.select_rect)
            self.select_rect = None
        for bid in self._get_blocks_in_rect(self.select_start_x, self.select_start_y, x, y):
            self._select_block(bid)
    
    def _select_block(self, block_id: int):
        if block_id not in self.selected_blocks:
            self.selected_blocks.add(block_id)
            if block_id in self.block_items:
                self.canvas.itemconfig(self.block_items[block_id], outline="#60A5FA", width=3)
    
    def _deselect_block(self, block_id: int):
        if block_id in self.selected_blocks:
            self.selected_blocks.remove(block_id)
            if block_id in self.block_items:
                self.canvas.itemconfig(self.block_items[block_id], outline="#FFFFFF", width=2)
    
    def _clear_selection(self):
        for bid in list(self.selected_blocks):
            self._deselect_block(bid)
    
    def _on_delete_key(self, event):
        if self.selected_blocks and self.on_blocks_delete:
            self.on_blocks_delete(list(self.selected_blocks))
            self.selected_blocks.clear()
    
    def _on_escape(self, event):
        self._clear_selection()
        if self.drawing:
            self.drawing = False
            if self.draw_preview:
                self.canvas.delete(self.draw_preview)
    
    def _toggle_block_status(self, block_id: int):
        block = self.blocks.get(block_id)
        if block:
            new_status = (block.get('status', 0) + 1) % 3
            block['status'] = new_status
            self._update_block_visual(block_id)
            if self.on_block_status_change:
                self.on_block_status_change(block_id, new_status)
    
    def _on_double_click(self, event):
        block_id = self._get_block_at(event.x, event.y)
        if block_id:
            self._toggle_block_status(block_id)
    
    def _on_right_click(self, event):
        block_id = self._get_block_at(event.x, event.y)
        if block_id and self.on_block_right_click:
            self.on_block_right_click(block_id, event.x_root, event.y_root)
    
    def _on_pan_start(self, event):
        """Start panning with middle mouse."""
        self.is_panning = True
        self.pan_start_x = event.x
        self.pan_start_y = event.y
        self.canvas.configure(cursor="fleur")
    
    def _on_pan(self, event):
        """Pan the view - works in all directions."""
        if not self.is_panning:
            return
        dx = event.x - self.pan_start_x
        dy = event.y - self.pan_start_y
        
        # Update offset - dy is inverted because screen Y goes down
        self.offset_x += dx
        self.offset_y -= dy  # Subtract because screen Y is inverted
        
        self.pan_start_x = event.x
        self.pan_start_y = event.y
        self._redraw_all()
    
    def _on_pan_end(self, event):
        self.is_panning = False
        cursor = "crosshair" if self.mode in [self.MODE_DRAW_RECT, self.MODE_DRAW_CIRCLE] else "hand2"
        self.canvas.configure(cursor=cursor)
    
    def _on_scroll(self, event):
        """Zoom in/out centered on mouse."""
        factor = 1.15 if event.delta > 0 else 0.87
        new_scale = self.scale * factor
        if new_scale < 0.1 or new_scale > 5.0:
            return
        
        # Get world position at mouse
        wx, wy = self._screen_to_world(event.x, event.y)
        
        # Update scale
        self.scale = new_scale
        
        # Adjust offsets so the mouse position stays at the same world coordinate
        ch = self.canvas.winfo_height() or 800
        self.offset_x = event.x - wx * self.scale
        self.offset_y = ch - event.y - wy * self.scale
        
        self._redraw_all()
    
    def _on_resize(self, event):
        self._draw_grid()
    
    def load_blocks(self, blocks: List[Dict]):
        """Load blocks."""
        self.blocks.clear()
        self.block_items.clear()
        self.block_labels.clear()
        self.item_to_block.clear()
        self.selected_blocks.clear()
        self.canvas.delete("block")
        
        for block in blocks:
            self.add_block(block)
        self._draw_grid()
    
    def add_block(self, block: Dict):
        """Add a single block."""
        block_id = block['id']
        self.blocks[block_id] = block.copy()
        self._draw_block(block)
    
    def _draw_block(self, block: Dict):
        """Draw a block (rect or circle)."""
        block_id = block['id']
        shape = block.get('shape', SHAPE_RECT)
        status = block.get('status', 0)
        fill = STATUS_COLORS.get(status, STATUS_COLORS[0])
        code = block.get('code', '')
        font_size = max(8, int(11 * self.scale))
        
        if shape == SHAPE_CIRCLE:
            cx, cy = block.get('pos_x', 0), block.get('pos_y', 0)
            diameter = block.get('diameter', 50)
            r = diameter * self.scale / 2
            sx, sy = self._world_to_screen(cx, cy)
            
            item = self.canvas.create_oval(
                sx - r, sy - r, sx + r, sy + r,
                fill=fill, outline="#FFFFFF", width=2, tags="block"
            )
            label = self.canvas.create_text(
                sx, sy, text=code, fill="#FFFFFF",
                font=("Arial", font_size, "bold"), tags="block"
            )
        else:
            px, py = block.get('pos_x', 0), block.get('pos_y', 0)
            w, h = block.get('width', 60), block.get('height', 40)
            # Bottom-left corner of rectangle
            sx1, sy1 = self._world_to_screen(px, py)
            sx2, sy2 = self._world_to_screen(px + w, py + h)
            
            item = self.canvas.create_rectangle(
                sx1, sy1, sx2, sy2,
                fill=fill, outline="#FFFFFF", width=2, tags="block"
            )
            label = self.canvas.create_text(
                (sx1 + sx2) / 2, (sy1 + sy2) / 2, text=code, fill="#FFFFFF",
                font=("Arial", font_size, "bold"), tags="block"
            )
        
        self.block_items[block_id] = item
        self.block_labels[block_id] = label
        self.item_to_block[item] = block_id
        self.item_to_block[label] = block_id
    
    def _update_block_visual(self, block_id: int):
        """Update block visual."""
        if block_id not in self.blocks:
            return
        
        if block_id in self.block_items:
            old_item = self.block_items[block_id]
            old_label = self.block_labels[block_id]
            self.canvas.delete(old_item)
            self.canvas.delete(old_label)
            if old_item in self.item_to_block:
                del self.item_to_block[old_item]
            if old_label in self.item_to_block:
                del self.item_to_block[old_label]
        
        self._draw_block(self.blocks[block_id])
        
        if block_id in self.selected_blocks:
            self.canvas.itemconfig(self.block_items[block_id], outline="#60A5FA", width=3)
    
    def _redraw_all(self):
        """Redraw everything."""
        self._draw_grid()
        for block_id in list(self.blocks.keys()):
            self._update_block_visual(block_id)
    
    def fit_to_view(self):
        """Fit blocks in view."""
        ch = self.canvas.winfo_height() or 800
        cw = self.canvas.winfo_width() or 800
        
        if not self.blocks:
            self.scale = 1.0
            self.offset_x = 80
            self.offset_y = 80
            self._redraw_all()
            return
        
        min_x = min(b.get('pos_x', 0) for b in self.blocks.values())
        min_y = min(b.get('pos_y', 0) for b in self.blocks.values())
        max_x = max(b.get('pos_x', 0) + b.get('width', b.get('diameter', 60)) for b in self.blocks.values())
        max_y = max(b.get('pos_y', 0) + b.get('height', b.get('diameter', 40)) for b in self.blocks.values())
        
        padding = 80
        world_w = max_x - min_x + padding
        world_h = max_y - min_y + padding
        
        scale_x = (cw - 100) / max(world_w, 1)
        scale_y = (ch - 100) / max(world_h, 1)
        self.scale = min(scale_x, scale_y, 2.0)
        self.scale = max(self.scale, 0.2)
        
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        self.offset_x = cw / 2 - center_x * self.scale
        self.offset_y = ch / 2 - center_y * self.scale
        
        self._redraw_all()
    
    def remove_block(self, block_id: int):
        """Remove a block."""
        if block_id in self.block_items:
            self.canvas.delete(self.block_items[block_id])
            self.canvas.delete(self.block_labels[block_id])
            if self.block_items[block_id] in self.item_to_block:
                del self.item_to_block[self.block_items[block_id]]
            if self.block_labels[block_id] in self.item_to_block:
                del self.item_to_block[self.block_labels[block_id]]
            del self.block_items[block_id]
            del self.block_labels[block_id]
            del self.blocks[block_id]
        self.selected_blocks.discard(block_id)
    
    def update_block_data(self, block_id: int, data: Dict):
        if block_id in self.blocks:
            self.blocks[block_id].update(data)
            self._update_block_visual(block_id)
    
    def get_zoom_level(self) -> float:
        return self.scale * 100
    
    def get_selected_count(self) -> int:
        return len(self.selected_blocks)
    
    # Drop support for drag from shapes panel
    def handle_drop(self, screen_x: int, screen_y: int, shape_data: Dict, block_name: str = None):
        """Handle drop from shapes panel with name."""
        # Convert screen coords (relative to canvas) to world
        wx, wy = self._screen_to_world(screen_x, screen_y)
        shape = shape_data.get('shape', SHAPE_RECT)
        
        if shape == SHAPE_CIRCLE:
            diameter = shape_data.get('diameter', 50)
            if self.on_block_created:
                self.on_block_created(wx, wy, diameter, 0, SHAPE_CIRCLE, block_name)
        else:
            width = shape_data.get('width', 60)
            height = shape_data.get('height', 40)
            if self.on_block_created:
                self.on_block_created(wx, wy, width, height, SHAPE_RECT, block_name)

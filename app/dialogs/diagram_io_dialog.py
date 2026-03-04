"""
Diagram Export/Import Dialog
- ExportDiagramDialog: Preview & save diagram to JSON file.
- ImportDiagramDialog: Load JSON file & restore diagram data.
"""

import json
import customtkinter as ctk
from tkinter import filedialog, messagebox
from typing import Dict, Callable, Optional


class ExportDiagramDialog(ctk.CTkToplevel):
    """Dialog to preview project info and choose export path."""

    def __init__(
        self,
        master,
        project_data: Dict,
        on_export: Callable[[str], None],
        **kwargs,
    ):
        super().__init__(master, **kwargs)

        self.project_data = project_data
        self.on_export = on_export

        self.title("📤 Export Sơ đồ")
        self.geometry("500x400")
        self.resizable(False, False)
        self.transient(master)
        self.grab_set()

        self._create_widgets()
        self._center(master)
        self.focus_force()

    def _center(self, master):
        self.update_idletasks()
        x = master.winfo_x() + (master.winfo_width() - 500) // 2
        y = master.winfo_y() + (master.winfo_height() - 400) // 2
        self.geometry(f"+{max(0, x)}+{max(0, y)}")

    def _create_widgets(self):
        main = ctk.CTkFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=20, pady=20)

        # Header
        ctk.CTkLabel(
            main,
            text="📤 Export Sơ đồ ra File JSON",
            font=("Arial", 18, "bold"),
        ).pack(anchor="w", pady=(0, 15))

        # Summary card
        info_frame = ctk.CTkFrame(main, fg_color="#1E3A5F")
        info_frame.pack(fill="x", pady=(0, 15))

        project = self.project_data.get("project", {})
        categories = self.project_data.get("categories", [])
        blocks = self.project_data.get("blocks", [])
        exported_at = self.project_data.get("exported_at", "")[:19].replace("T", " ")

        rows = [
            ("🏗️ Dự án", project.get("name", "")),
            ("📁 Danh mục", f"{len(categories)} hạng mục"),
            ("🧱 Blocks", f"{len(blocks)} blocks"),
            ("📅 Thời gian", exported_at),
        ]
        for label, value in rows:
            row = ctk.CTkFrame(info_frame, fg_color="transparent")
            row.pack(fill="x", padx=15, pady=4)
            ctk.CTkLabel(row, text=label, font=("Arial", 12), width=120, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=value, font=("Arial", 12, "bold"), text_color="#60A5FA").pack(side="left")

        # File path selection
        ctk.CTkLabel(main, text="Nơi lưu file:", font=("Arial", 12)).pack(anchor="w", pady=(10, 4))

        path_frame = ctk.CTkFrame(main, fg_color="transparent")
        path_frame.pack(fill="x", pady=(0, 15))

        self.path_var = ctk.StringVar(value="")
        self.path_entry = ctk.CTkEntry(path_frame, textvariable=self.path_var, height=36, state="readonly")
        self.path_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))

        ctk.CTkButton(
            path_frame,
            text="📂 Chọn",
            width=80,
            height=36,
            fg_color="#374151",
            hover_color="#4B5563",
            command=self._choose_path,
        ).pack(side="right")

        # Buttons
        btn_frame = ctk.CTkFrame(main, fg_color="transparent")
        btn_frame.pack(fill="x", side="bottom")

        ctk.CTkButton(
            btn_frame,
            text="❌ Hủy",
            width=110,
            height=40,
            fg_color="#6B7280",
            hover_color="#4B5563",
            command=self.destroy,
        ).pack(side="right", padx=(8, 0))

        self.export_btn = ctk.CTkButton(
            btn_frame,
            text="📤 Export",
            width=130,
            height=40,
            fg_color="#7C3AED",
            hover_color="#6D28D9",
            command=self._do_export,
        )
        self.export_btn.pack(side="right")

    def _choose_path(self):
        project_name = self.project_data.get("project", {}).get("name", "SoDo")
        safe_name = "".join(c for c in project_name if c.isalnum() or c in " _-").strip()
        default_file = f"SoDo_{safe_name}.json".replace(" ", "_")

        path = filedialog.asksaveasfilename(
            title="Lưu file sơ đồ",
            defaultextension=".json",
            initialfile=default_file,
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
        )
        if path:
            self.path_var.set(path)

    def _do_export(self):
        path = self.path_var.get().strip()
        if not path:
            messagebox.showwarning("Chưa chọn file", "Vui lòng chọn nơi lưu file trước!", parent=self)
            return
        self.on_export(path)
        self.destroy()


# ---------------------------------------------------------------------------


class ImportDiagramDialog(ctk.CTkToplevel):
    """Dialog to load a JSON diagram file and preview before restoring."""

    def __init__(
        self,
        master,
        on_confirm: Callable[[Dict, str], None],
        **kwargs,
    ):
        """
        on_confirm(data, mode) is called when user confirms.
        mode = "new" (create new project) or "replace" (overwrite current)
        """
        super().__init__(master, **kwargs)

        self.on_confirm = on_confirm
        self._loaded_data: Optional[Dict] = None

        self.title("📥 Import Sơ đồ từ File")
        self.geometry("530x460")
        self.resizable(False, False)
        self.transient(master)
        self.grab_set()

        self._create_widgets()
        self._center(master)
        self.focus_force()

    def _center(self, master):
        self.update_idletasks()
        x = master.winfo_x() + (master.winfo_width() - 530) // 2
        y = master.winfo_y() + (master.winfo_height() - 460) // 2
        self.geometry(f"+{max(0, x)}+{max(0, y)}")

    def _create_widgets(self):
        main = ctk.CTkFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=20, pady=20)

        ctk.CTkLabel(
            main,
            text="📥 Import Sơ đồ từ File JSON",
            font=("Arial", 18, "bold"),
        ).pack(anchor="w", pady=(0, 12))

        # File selection row
        ctk.CTkLabel(main, text="Chọn file sơ đồ (.json):", font=("Arial", 12)).pack(anchor="w", pady=(0, 4))

        file_frame = ctk.CTkFrame(main, fg_color="transparent")
        file_frame.pack(fill="x", pady=(0, 12))

        self.file_var = ctk.StringVar(value="")
        file_entry = ctk.CTkEntry(file_frame, textvariable=self.file_var, height=36, state="readonly")
        file_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))

        ctk.CTkButton(
            file_frame,
            text="📂 Chọn",
            width=80,
            height=36,
            fg_color="#374151",
            hover_color="#4B5563",
            command=self._choose_file,
        ).pack(side="right")

        # Preview info (hidden until file loaded)
        self.info_frame = ctk.CTkFrame(main, fg_color="#1E3A5F")
        self.info_frame.pack(fill="x", pady=(0, 12))
        self.info_frame.pack_forget()  # hide initially

        self.info_labels: Dict[str, ctk.CTkLabel] = {}
        for key, label in [
            ("project", "🏗️ Dự án"),
            ("categories", "📁 Danh mục"),
            ("blocks", "🧱 Blocks"),
            ("exported_at", "📅 Ngày tạo"),
        ]:
            row = ctk.CTkFrame(self.info_frame, fg_color="transparent")
            row.pack(fill="x", padx=15, pady=4)
            ctk.CTkLabel(row, text=label, font=("Arial", 12), width=120, anchor="w").pack(side="left")
            val_lbl = ctk.CTkLabel(row, text="-", font=("Arial", 12, "bold"), text_color="#60A5FA")
            val_lbl.pack(side="left")
            self.info_labels[key] = val_lbl

        # Import mode
        ctk.CTkLabel(main, text="Cách thức import:", font=("Arial", 12)).pack(anchor="w", pady=(4, 4))

        self.mode_var = ctk.StringVar(value="new")
        mode_frame = ctk.CTkFrame(main, fg_color="transparent")
        mode_frame.pack(fill="x", pady=(0, 12))

        ctk.CTkRadioButton(
            mode_frame,
            text="🆕 Tạo dự án mới (an toàn, không ảnh hưởng dữ liệu cũ)",
            variable=self.mode_var,
            value="new",
            font=("Arial", 12),
        ).pack(anchor="w", pady=2)

        ctk.CTkRadioButton(
            mode_frame,
            text="⚠️ Ghi đè dự án hiện tại (XÓA toàn bộ dữ liệu cũ!)",
            variable=self.mode_var,
            value="replace",
            font=("Arial", 12),
            fg_color="#EF4444",
        ).pack(anchor="w", pady=2)

        # Buttons
        btn_frame = ctk.CTkFrame(main, fg_color="transparent")
        btn_frame.pack(fill="x", side="bottom")

        ctk.CTkButton(
            btn_frame,
            text="❌ Hủy",
            width=110,
            height=40,
            fg_color="#6B7280",
            hover_color="#4B5563",
            command=self.destroy,
        ).pack(side="right", padx=(8, 0))

        self.import_btn = ctk.CTkButton(
            btn_frame,
            text="📥 Import",
            width=130,
            height=40,
            fg_color="#059669",
            hover_color="#047857",
            state="disabled",
            command=self._do_import,
        )
        self.import_btn.pack(side="right")

    def _choose_file(self):
        path = filedialog.askopenfilename(
            title="Chọn file sơ đồ",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
        )
        if not path:
            return

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if data.get("format") != "diagram_backup":
                messagebox.showerror(
                    "Lỗi định dạng",
                    "File này không phải file sơ đồ hợp lệ!\n(Thiếu trường 'format')",
                    parent=self,
                )
                return

            self._loaded_data = data
            self.file_var.set(path)

            # Update preview
            project = data.get("project", {})
            categories = data.get("categories", [])
            blocks = data.get("blocks", [])
            exported_at = data.get("exported_at", "")[:19].replace("T", " ")

            self.info_labels["project"].configure(text=project.get("name", ""))
            self.info_labels["categories"].configure(text=f"{len(categories)} hạng mục")
            self.info_labels["blocks"].configure(text=f"{len(blocks)} blocks")
            self.info_labels["exported_at"].configure(text=exported_at)

            self.info_frame.pack(fill="x", pady=(0, 12))
            self.import_btn.configure(state="normal")

        except json.JSONDecodeError:
            messagebox.showerror("Lỗi", "Không thể đọc file JSON. File có thể bị hỏng.", parent=self)
        except Exception as e:
            messagebox.showerror("Lỗi", f"Không thể mở file:\n{e}", parent=self)

    def _do_import(self):
        if not self._loaded_data:
            return

        mode = self.mode_var.get()
        if mode == "replace":
            confirm = messagebox.askyesno(
                "⚠️ Xác nhận ghi đè",
                "Hành động này sẽ XÓA TOÀN BỘ dữ liệu hiện tại và thay thế bằng dữ liệu từ file!\n\nBạn có chắc chắn?",
                parent=self,
                icon="warning",
            )
            if not confirm:
                return

        self.on_confirm(self._loaded_data, mode)
        self.destroy()

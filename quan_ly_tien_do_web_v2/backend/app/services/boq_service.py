import io
import json
import pandas as pd
from typing import Dict, Any, Tuple, List
from fastapi import UploadFile, HTTPException

class BOQService:
    @staticmethod
    async def process_project_boq_excel(file: UploadFile) -> List[Dict[str, Any]]:
        """
        Xử lý file Excel BOQ tổng mức dự án
        """
        content = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(content), header=0)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot read Excel file: {str(e)}")

        col_map = {
            'id': df.columns[0] if len(df.columns) > 0 else '',
            'tt': df.columns[1] if len(df.columns) > 1 else '',
            'name': df.columns[2] if len(df.columns) > 2 else '',
            'unit': df.columns[3] if len(df.columns) > 3 else '',
            'designQty': df.columns[4] if len(df.columns) > 4 else '',
            'unitPrice': df.columns[7] if len(df.columns) > 7 else '',
        }
        
        if not col_map.get('name'):
            raise HTTPException(status_code=400, detail="Cannot find 'Nội dung công việc' column in Excel file.")
        
        boq_items = []
        for _, row in df.iterrows():
            name_val = row.get(col_map.get('name', ''), '')
            if pd.isna(name_val) or str(name_val).strip() == '':
                continue
            
            item_id = str(row.get(col_map.get('id', ''), '')).strip()
            if item_id.endswith('.0'): item_id = item_id[:-2]
            if pd.isna(item_id) or item_id in ('', 'nan'):
                item_id = str(len(boq_items) + 1)
                
            tt_val = str(row.get(col_map.get('tt', ''), '')).strip()
            if tt_val.endswith('.0'): tt_val = tt_val[:-2]
            if pd.isna(tt_val) or tt_val in ('', 'nan'):
                tt_val = str(len(boq_items) + 1)
            
            def safe_float(val):
                try:
                    if pd.isna(val): return 0
                    if isinstance(val, str):
                        val = val.replace(',', '').replace(' ', '')
                    return float(val)
                except (ValueError, TypeError):
                    return 0
            
            design_qty = safe_float(row.get(col_map.get('designQty', ''), 0))
            unit_price = safe_float(row.get(col_map.get('unitPrice', ''), 0))
            
            boq_items.append({
                "id": item_id,
                "order": tt_val,
                "name": str(name_val).strip(),
                "unit": str(row.get(col_map.get('unit', ''), '')).strip() if not pd.isna(row.get(col_map.get('unit', ''), '')) else '',
                "designQty": design_qty,
                "unitPrice": unit_price,
                "contractAmount": round(design_qty * unit_price, 2),
            })
            
        return boq_items

    @staticmethod
    async def process_diagram_boq_sync_excel(
        file: UploadFile,
        project_boq_data: str,
        diagram_objects_json: str
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[str], List[Dict[str, Any]]]:
        """
        Xử lý file Excel đồng bộ khối lượng BOQ vào các khối geometry trên Diagram.
        """
        content = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(content), header=0)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot read Excel: {str(e)}")
        
        # Load project master BOQ for validation
        master_boq_ids = set()
        if project_boq_data:
            try:
                master_boq = json.loads(project_boq_data)
                master_boq_ids = {str(item.get('id', '')) for item in master_boq if isinstance(item, dict)}
            except (json.JSONDecodeError, TypeError):
                pass
        
        col_map = {
            'id': df.columns[0] if len(df.columns) > 0 else '',
            'tt': df.columns[1] if len(df.columns) > 1 else '',
            'name': df.columns[2] if len(df.columns) > 2 else '',
            'unit': df.columns[3] if len(df.columns) > 3 else '',
            'designQty': df.columns[4] if len(df.columns) > 4 else '',
            'unitPrice': df.columns[7] if len(df.columns) > 7 else '',
        }
        
        block_columns = {}
        for i, col in enumerate(df.columns):
            if i >= 11:
                block_columns[str(col).strip()] = col
        
        if not col_map.get('name'):
            raise HTTPException(status_code=400, detail="Cannot find 'Nội dung công việc' column.")
        
        objects_list = []
        if diagram_objects_json:
            try:
                objects_list = json.loads(diagram_objects_json)
            except (json.JSONDecodeError, TypeError):
                objects_list = []
        
        diagram_block_ids = {str(obj.get('id', '')) for obj in objects_list if isinstance(obj, dict)}
        excel_block_ids = set(block_columns.keys())
        
        # Prefix Match Mapping Logic
        excel_to_diagram_blocks = {}
        for bid in excel_block_ids:
            matched = []
            if bid in diagram_block_ids:
                matched = [bid]
            else:
                for d_bid in diagram_block_ids:
                    if d_bid.startswith(bid):
                        matched.append(d_bid)
            excel_to_diagram_blocks[bid] = matched
        
        def safe_float(val):
            try:
                if pd.isna(val): return 0
                if isinstance(val, str):
                    val = val.replace(',', '').replace(' ', '')
                return float(val)
            except (ValueError, TypeError):
                return 0
        
        boq_items = []
        block_boq_map = {bid: {} for bid in diagram_block_ids}
        excel_has_quantities = set()
        
        for _, row in df.iterrows():
            name_val = row.get(col_map.get('name', ''), '')
            if pd.isna(name_val) or str(name_val).strip() == '':
                continue
            
            item_id = str(row.get(col_map.get('id', ''), '')).strip()
            if item_id.endswith('.0'): item_id = item_id[:-2]
            if pd.isna(item_id) or item_id in ('', 'nan'):
                item_id = str(len(boq_items) + 1)
                
            tt_val = str(row.get(col_map.get('tt', ''), '')).strip()
            if tt_val.endswith('.0'): tt_val = tt_val[:-2]
            if pd.isna(tt_val) or tt_val in ('', 'nan'):
                tt_val = str(len(boq_items) + 1)
            
            design_qty = safe_float(row.get(col_map.get('designQty', ''), 0))
            unit_price = safe_float(row.get(col_map.get('unitPrice', ''), 0))
            unit_val = row.get(col_map.get('unit', ''), '')
            
            boq_item = {
                "id": item_id,
                "order": tt_val,
                "name": str(name_val).strip(),
                "unit": str(unit_val).strip() if not pd.isna(unit_val) else '',
                "designQty": design_qty,
                "unitPrice": unit_price,
                "contractAmount": round(design_qty * unit_price, 2),
                "actualQty": 0,
                "actualAmount": 0,
                "planQty": 0,
                "planAmount": 0,
            }
            
            for ex_bid, col_name in block_columns.items():
                qty = safe_float(row.get(col_name, 0))
                if qty > 0:
                    excel_has_quantities.add(ex_bid)
                    matched_diagram_blocks = excel_to_diagram_blocks.get(ex_bid, [])
                    if matched_diagram_blocks:
                        qty_per_block = round(qty / len(matched_diagram_blocks), 4)
                        for d_bid in matched_diagram_blocks:
                            block_boq_map[d_bid][item_id] = qty_per_block
                        boq_item["actualQty"] += qty
            
            boq_item["actualAmount"] = round(boq_item["actualQty"] * unit_price, 2)
            boq_items.append(boq_item)
            
        # Update objects with boqIds mapping
        for obj in objects_list:
            obj_id = str(obj.get('id', ''))
            if obj_id in block_boq_map and block_boq_map[obj_id]:
                obj['boqIds'] = block_boq_map[obj_id]
                
        sync_report = {
            "matched": [],
            "excel_only": [],
            "diagram_only": [],
            "empty": [],
        }
        
        mapped_diagram_blocks = set()
        for ex_bid in excel_block_ids:
            matched_diagram_blocks = excel_to_diagram_blocks.get(ex_bid, [])
            if not matched_diagram_blocks:
                sync_report["excel_only"].append(ex_bid)
            elif ex_bid not in excel_has_quantities:
                sync_report["empty"].append(ex_bid)
            else:
                label = f"{ex_bid} -> {len(matched_diagram_blocks)} blocks" if len(matched_diagram_blocks) > 1 else ex_bid
                boq_ids_mapped = set()
                total_qty_sum = 0
                for d_bid in matched_diagram_blocks:
                    boq_ids_mapped.update(block_boq_map[d_bid].keys())
                    total_qty_sum += sum(block_boq_map[d_bid].values())
                    
                sync_report["matched"].append({
                    "block_id": label,
                    "items_count": len(boq_ids_mapped),
                    "total_qty": round(total_qty_sum, 2)
                })
                mapped_diagram_blocks.update(matched_diagram_blocks)
                
        for bid in diagram_block_ids:
            if bid not in mapped_diagram_blocks:
                sync_report["diagram_only"].append(bid)
        
        boq_warnings = []
        if master_boq_ids:
            for item in boq_items:
                if str(item['id']) not in master_boq_ids:
                    boq_warnings.append(f"BOQ item '{item['id']}: {item['name']}' not found in project master BOQ")
        
        return boq_items, sync_report, boq_warnings, objects_list

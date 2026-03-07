import json
import os
from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "../../../../../frontend/config/bridge-config.json")

class BridgeConfig(BaseModel):
    bridge: Dict[str, Any]

@router.get("", response_model=BridgeConfig)
def get_config():
    """
    Get current bridge configuration
    """
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(status_code=404, detail="Config file not found")
    
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading config: {str(e)}")

@router.post("", response_model=BridgeConfig)
def save_config(config: BridgeConfig):
    """
    Save bridge configuration
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config.dict(), f, indent=2, ensure_ascii=False)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving config: {str(e)}")

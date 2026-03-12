try:
    from app import models
    print(f"Diagram has 'objects': {hasattr(models.Diagram, 'objects')}")
    print(f"Diagram has 'boq_data': {hasattr(models.Diagram, 'boq_data')}")
    
    from sqlalchemy import inspect
    mapper = inspect(models.Diagram)
    print("\nColumns in Diagram model:")
    for col in mapper.attrs:
        print(f"- {col.key}")
        
except Exception as e:
    print(f"Error: {e}")

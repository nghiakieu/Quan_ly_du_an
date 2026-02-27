import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
models = []
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        models.append(m.name)

with open('models_utf8.txt', 'w', encoding='utf-8') as f:
    f.write("Available models:\n")
    for m in models:
        f.write(m + "\n")

import google.generativeai as genai
import os

# Configuramos con tu clave
genai.configure(api_key="AIzaSyBYMuA1h6E1GuyJdBA54JlIPxL5UbSrcJ8")

print("🔍 CONSULTANDO A GOOGLE LOS MODELOS DISPONIBLES...")
print("-" * 40)

try:
    for m in genai.list_models():
        # Solo queremos modelos que generen contenido (texto/chat)
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ {m.name}")
except Exception as e:
    print(f"❌ Error al listar: {e}")

print("-" * 40)

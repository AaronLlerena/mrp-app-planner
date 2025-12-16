import google.generativeai as genai

# Tu clave API
genai.configure(api_key="AIzaSyAGp0vC9L2XCUpOIznHfAW0ANyLhEOGCwI")

print("🔍 BUSCANDO MODELOS DISPONIBLES...")
print("-----------------------------------")

try:
    for m in genai.list_models():
        # Solo queremos modelos que sirvan para generar contenido (texto/chat)
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ Disponible: {m.name}")
except Exception as e:
    print(f"❌ Error al conectar: {e}")

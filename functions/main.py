import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app
import google.generativeai as genai

initialize_app()

# --- TU CLAVE DE GEMINI ---
API_KEY = "AIzaSyAGp0vC9L2XCUpOIznHfAW0ANyLhEOGCwI"
# --------------------------

genai.configure(api_key=API_KEY)

@https_fn.on_request(min_instances=0, max_instances=1)
def procesar_op(req: https_fn.Request) -> https_fn.Response:
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=headers)

    try:
        req_json = req.get_json()
        if not req_json or 'image' not in req_json:
            return https_fn.Response(json.dumps({"error": "Falta la imagen"}), status=400, headers=headers)
            
        imagen_b64 = req_json['image']
        if "," in imagen_b64:
            imagen_b64 = imagen_b64.split(",")[1]

        model = genai.GenerativeModel('gemini-flash-latest')
        
        # --- PROMPT MEJORADO PARA DETECTAR EMPAQUES ---
        prompt = """
        Analiza esta imagen de una Orden de Producción.
        Extrae el NÚMERO DE OP y la lista de insumos/materiales.
        
        REGLA IMPORTANTE PARA MATERIALES DE EMPAQUE:
        Si detectas una tabla de materiales de empaque, en el campo "nombre" concatena el NOMBRE + OBSERVACIONES (ej: "Envase HDPE + Color Blanco").
        
        Devuelve JSON estricto:
        {
            "numero_op": "00000",
            "producto": "Nombre del producto",
            "insumos": [
                {"nombre": "Nombre Insumo Completo", "cantidad": 0, "unidad": "kg/und"}
            ]
        }
        Responde SOLO con el JSON.
        """

        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': imagen_b64},
            prompt
        ])
        
        texto = response.text.replace('```json', '').replace('```', '').strip()
        datos = json.loads(texto)

        return https_fn.Response(json.dumps({
            "mensaje": f"¡OP {datos.get('numero_op', '???')} procesada!",
            "datos": datos
        }), status=200, headers=headers)

    except Exception as e:
        return https_fn.Response(json.dumps({"error": str(e)}), status=500, headers=headers)
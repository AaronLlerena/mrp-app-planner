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
        
        # --- PROMPT MEJORADO: CATEGORÍAS Y LIMPIEZA ---
        prompt = """
        Analiza esta Orden de Producción. Extrae: NÚMERO OP y lista de items.
        
        REGLAS CLAVE:
        1. Clasifica cada item en "categoria": "INSUMO" (materia prima) o "EMPAQUE" (material de envase).
        2. Para EMPAQUES: Concatena NOMBRE y OBSERVACIONES en el campo "nombre", separados solo por espacio. NO USES el símbolo "+" para unir.
           Ejemplo correcto: "Pote HDPE Color Blanco".
           Ejemplo incorrecto: "Pote HDPE + Color Blanco".
        3. Normaliza nombres: "Maltodextrina" y "MALTODEXTRINA" deben ser iguales (usa mayúsculas).

        JSON Estricto:
        {
            "numero_op": "00000",
            "items": [
                {"nombre": "NOMBRE LIMPIO", "cantidad": 0, "unidad": "kg/und", "categoria": "INSUMO"}
            ]
        }
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
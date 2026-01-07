import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app, get_app
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

try:
    get_app()
except ValueError:
    initialize_app()

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
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return https_fn.Response(json.dumps({"error": "Error: API Key no encontrada."}), status=500, headers=headers)

        genai.configure(api_key=api_key)

        req_json = req.get_json()
        if not req_json or 'image' not in req_json:
            return https_fn.Response(json.dumps({"error": "Falta la imagen"}), status=400, headers=headers)
            
        imagen_b64 = req_json['image']
        if "," in imagen_b64:
            imagen_b64 = imagen_b64.split(",")[1]

        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # --- PROMPT REFORZADO PARA LEER COLUMNAS ---
        prompt = """
        Actúa como un analista de datos experto extrayendo tablas de imágenes.
        
        TAREA:
        1. Identifica la tabla de "MATERIA PRIMA" y "MATERIAL DE EMPAQUE".
        2. Localiza EXACTAMENTE la columna con el encabezado "STOCK" (o similar).
        3. Para CADA fila de item, sigue la línea horizontalmente hasta encontrar el valor en esa columna "STOCK".
        
        REGLAS DE EXTRACCIÓN DE VALORES:
        - Si en la columna STOCK hay un número (ej: "233.51", "1001"), extráelo como `stock_detectado`.
        - Si la celda de STOCK está vacía, en blanco o tiene un guión "-", el `stock_detectado` es 0.
        - ¡No inventes valores! Si está vacío es 0.
        
        REGLAS DE TEXTO:
        - INSUMO: Solo nombre limpio.
        - EMPAQUE: Concatena Nombre + Observaciones.
        
        Tu respuesta debe ser UNICAMENTE este JSON:
        {
            "numero_op": "00000",
            "items": [
                {
                    "nombre": "Maltodextrina", 
                    "cantidad": 233.51, 
                    "unidad": "kg", 
                    "categoria": "INSUMO",
                    "stock_detectado": 0.00  // Valor numérico exacto de la columna STOCK
                }
            ]
        }
        """

        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': imagen_b64},
            prompt
        ])
        
        texto = response.text.replace('```json', '').replace('```', '').strip()
        
        # Limpieza robusta del JSON por si la IA añade texto extra
        try:
            datos = json.loads(texto)
        except:
            start = texto.find('{')
            end = texto.rfind('}') + 1
            datos = json.loads(texto[start:end])

        return https_fn.Response(json.dumps({
            "mensaje": f"¡OP {datos.get('numero_op', '???')} procesada!",
            "datos": datos
        }), status=200, headers=headers)

    except Exception as e:
        return https_fn.Response(json.dumps({
            "error": str(e),
            "mensaje": "Error: " + str(e)
        }), status=500, headers=headers)
import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app
import google.generativeai as genai

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
        # 1. Configuración Segura
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return https_fn.Response(json.dumps({"error": "Error: No API Key found."}), status=500, headers=headers)

        genai.configure(api_key=api_key)

        req_json = req.get_json()
        if not req_json or 'image' not in req_json:
            return https_fn.Response(json.dumps({"error": "Falta la imagen"}), status=400, headers=headers)
            
        imagen_b64 = req_json['image']
        if "," in imagen_b64:
            imagen_b64 = imagen_b64.split(",")[1]

        # 2. Modelo Rápido
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # 3. Prompt Simplificado (Solo Datos, SIN colores)
        prompt = """
        Analiza esta Orden de Producción.
        
        OBJETIVO: Extraer datos estructurados de Insumos y Empaques.
        
        REGLAS DE CLASIFICACIÓN:
        - "INSUMO": Materias primas (ej: Colágeno, Saborizantes, Vitaminas).
        - "EMPAQUE": Materiales de envase (ej: Potes, Tapas, Etiquetas).
        
        REGLAS DE TEXTO:
        - Para "EMPAQUE": Concatena NOMBRE + OBSERVACIONES en un solo string.
        - Para "INSUMO": Solo el nombre normalizado.
        
        Responde SOLO con este JSON:
        {
            "numero_op": "00000",
            "items": [
                {
                    "nombre": "Nombre del Item", 
                    "cantidad": 0, 
                    "unidad": "kg/und", 
                    "categoria": "INSUMO"
                }
            ]
        }
        """

        # 4. Generar
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': imagen_b64},
            prompt
        ])
        
        texto = response.text.replace('```json', '').replace('```', '').strip()
        
        try:
            datos = json.loads(texto)
        except:
            # Fallback simple
            start = texto.find('{')
            end = texto.rfind('}') + 1
            datos = json.loads(texto[start:end])

        return https_fn.Response(json.dumps({
            "mensaje": f"¡OP {datos.get('numero_op', '???')} procesada!",
            "datos": datos
        }), status=200, headers=headers)

    except Exception as e:
        return https_fn.Response(json.dumps({"error": str(e)}), status=500, headers=headers)
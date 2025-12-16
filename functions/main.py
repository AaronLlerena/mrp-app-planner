import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app
import google.generativeai as genai

initialize_app()

# --- SEGURIDAD: Leer la clave desde Variables de Entorno ---
API_KEY = os.environ.get("GEMINI_API_KEY")
# -----------------------------------------------------------

if API_KEY:
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
        # 1. Verificación de Seguridad
        if not API_KEY:
            return https_fn.Response(json.dumps({
                "error": "CRÍTICO: No se encontró la API Key. Asegúrate de tener el archivo .env configurado."
            }), status=500, headers=headers)

        # 2. Obtener datos
        req_json = req.get_json()
        if not req_json or 'image' not in req_json:
            return https_fn.Response(json.dumps({"error": "Falta la imagen"}), status=400, headers=headers)
            
        imagen_b64 = req_json['image']
        if "," in imagen_b64:
            imagen_b64 = imagen_b64.split(",")[1]

        # 3. Configurar Modelo (CORRECCIÓN AQUÍ: Usamos el alias más compatible)
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        # 4. Instrucciones para la IA (Prompt) - LÓGICA DE COLOR VERDE INCLUIDA
        prompt = """
        Analiza esta Orden de Producción (imagen).
        
        OBJETIVO: Extraer datos y DETECTAR STOCK POR COLOR.
        
        REGLA DE COLOR (IMPORTANTE):
        - Fíjate en el fondo de las filas de la tabla.
        - Si una fila o el nombre del insumo está RESALTADO EN VERDE (o verde amarillento), significa que YA HAY STOCK.
        - Marca el campo "tiene_stock_visual": true para esos items. Para el resto, false.

        REGLAS DE CLASIFICACIÓN:
        - "INSUMO": Materias primas (ej: Colágeno, Maltodextrina, Ácido Cítrico).
        - "EMPAQUE": Materiales de envase (ej: Potes, Tapas, Etiquetas, Termoencogibles).
        
        REGLAS DE LIMPIEZA:
        - Para "EMPAQUE": Concatena NOMBRE + OBSERVACIONES (separado por espacio).
        - Para "INSUMO": Solo nombre normalizado.
        
        JSON Estricto:
        {
            "numero_op": "00000",
            "items": [
                {
                    "nombre": "Nombre Limpio", 
                    "cantidad": 0, 
                    "unidad": "kg/und", 
                    "categoria": "INSUMO",
                    "tiene_stock_visual": true/false
                }
            ]
        }
        """

        # 5. Generar
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': imagen_b64},
            prompt
        ])
        
        # 6. Limpiar respuesta markdown
        texto = response.text.replace('', '').strip()
        datos = json.loads(texto)

        return https_fn.Response(json.dumps({
            "mensaje": f"¡OP {datos.get('numero_op', '???')} procesada!",
            "datos": datos
        }), status=200, headers=headers)

    except Exception as e:
        return https_fn.Response(json.dumps({
            "error": str(e),
            "mensaje": "Error interno: " + str(e)
        }), status=500, headers=headers)

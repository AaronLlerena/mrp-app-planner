import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app, get_app
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Cargar el archivo secreto .env automáticamente
load_dotenv()

# 2. Inicializar Firebase de forma segura
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
        # 3. SEGURIDAD: Leer la clave
        api_key = os.environ.get("GEMINI_API_KEY")
        
        if not api_key:
            return https_fn.Response(json.dumps({
                "error": "Error Crítico: API Key no encontrada en el servidor."
            }), status=500, headers=headers)

        genai.configure(api_key=api_key)

        # 4. Procesar Datos
        req_json = req.get_json()
        if not req_json or 'image' not in req_json:
            return https_fn.Response(json.dumps({"error": "Falta la imagen"}), status=400, headers=headers)
            
        imagen_b64 = req_json['image']
        if "," in imagen_b64:
            imagen_b64 = imagen_b64.split(",")[1]

        # 5. Modelo Rápido
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # 6. Prompt ACTUALIZADO para leer columna STOCK
        prompt = """
        Analiza esta Orden de Producción (imagen de hoja de cálculo).
        
        OBJETIVO: Extraer los items de MATERIA PRIMA e INSUMOS, incluyendo la nueva columna "STOCK".
        
        REGLAS DE EXTRACCIÓN:
        1. Busca las secciones de "MATERIA PRIMA" y "MATERIAL DE EMPAQUE".
        2. Para cada fila, extrae: Nombre, Cantidad (o %) y la Unidad estimada.
        3. **CRÍTICO: Busca la columna titulada "STOCK"** (usualmente a la derecha de la cantidad/porcentaje).
           - Si hay un número en la columna "STOCK" para esa fila, extráelo como `stock_detectado`.
           - Si la celda "STOCK" está vacía, el `stock_detectado` debe ser 0.
        
        REGLAS DE LIMPIEZA:
        - "INSUMO": Materias primas.
        - "EMPAQUE": Materiales de envase (Concatena Nombre + Observaciones).
        
        Responde SOLO con este JSON estricto:
        {
            "numero_op": "00000",
            "items": [
                {
                    "nombre": "Nombre del Item", 
                    "cantidad": 100.50, 
                    "unidad": "kg/und", 
                    "categoria": "INSUMO",
                    "stock_detectado": 50.00  // Valor de la columna STOCK o 0 si está vacía
                }
            ]
        }
        """

        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': imagen_b64},
            prompt
        ])
        
        texto = response.text.replace('```json', '').replace('```', '').strip()
        try:
            datos = json.loads(texto)
        except:
            # Fallback por si la IA devuelve texto extra antes o después del JSON
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
            "mensaje": "Error en el servidor: " + str(e)
        }), status=500, headers=headers)
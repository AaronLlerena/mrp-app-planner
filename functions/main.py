import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app
import google.generativeai as genai

initialize_app()

# --- SEGURIDAD: Leer la clave desde Variables de Entorno ---
# Esto busca la clave en el archivo .env oculto o en la configuración de Firebase
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

        # 3. Configurar Modelo
        model = genai.GenerativeModel('gemini-flash-latest')
        
        # 4. Instrucciones para la IA (Prompt)
        prompt = """
        Analiza esta Orden de Producción (imagen).
        
        OBJETIVO 1: Extraer el NÚMERO DE OP.
        OBJETIVO 2: Extraer la lista de items y clasificarlos.
        
        REGLAS DE CLASIFICACIÓN (IMPORTANTE):
        - "INSUMO": Materias primas (ej: Maltodextrina, Citrato, Saborizantes, Vitaminas).
        - "EMPAQUE": Materiales de envase (ej: Potes, Tapas, Cajas, Etiquetas, Scoops, Termoencogibles).
        
        REGLAS DE LIMPIEZA DE TEXTO:
        - Para "EMPAQUE": Si hay una columna de 'Observaciones' o detalles visuales, agrégala al nombre.
          ¡MUY IMPORTANTE!: Únelos usando SOLO UN ESPACIO. NO USES EL SIGNO '+'.
          Ejemplo CORRECTO: "Pote HDPE 310 Color Blanco"
          Ejemplo INCORRECTO: "Pote HDPE 310 + Color Blanco"
        - Para "INSUMO": Solo el nombre del ingrediente. Normaliza mayúsculas (ej: "Maltodextrina").
        
        Devuelve SOLO este JSON estricto:
        {
            "numero_op": "00000",
            "items": [
                {"nombre": "Nombre Limpio", "cantidad": 0, "unidad": "kg/und", "categoria": "INSUMO"}
            ]
        }
        """

        # 5. Generar
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': imagen_b64},
            prompt
        ])
        
        # 6. Limpiar respuesta markdown
        texto = response.text.replace('```json', '').replace('```', '').strip()
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
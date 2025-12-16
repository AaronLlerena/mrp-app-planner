import json
import os
from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
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
        req_json = req.get_json()
        if not req_json:
            return https_fn.Response("No JSON", status=400, headers=headers)
            
        # Aqui ira la logica de Gemini mas adelante
        respuesta = {
            "mensaje": "Conexion exitosa con Python",
            "estado": "listo"
        }
        
        return https_fn.Response(json.dumps(respuesta), status=200, headers=headers)

    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500, headers=headers)

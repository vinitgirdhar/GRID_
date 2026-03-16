from airllm import AutoModel
import torch
import os

# Initialize the model (sharded for local execution)
# Note: This will download the model on first run (~15GB)
MODEL_NAME = "meta-llama/Llama-3-8B"

_model = None

def get_model():
    global _model
    if _model is None:
        try:
            # We use a smaller max length for faster local inference
            _model = AutoModel.from_pretrained(MODEL_NAME)
        except Exception as e:
            print(f"Error loading AirLLM model: {e}")
            return None
    return _model

def generate_driver_guidance(query, context, drowsiness_status):
    """
    Generates smart guidance for the driver using the local LLM.
    """
    model = get_model()
    if not model:
        return "I'm having trouble connecting to my local brain right now. Please drive safely.", "error"

    prompt = f"""
    You are GRID Pilot, a local AI assistant for taxi drivers.
    
    SYSTEM CONTEXT:
    {context}
    
    DRIVER ALERTNESS:
    Status: {drowsiness_status.get('status')}
    Severity: {drowsiness_status.get('severity')}
    
    DRIVER QUERY:
    {query}
    
    Rules:
    - Keep responses SHORT (1-2 sentences).
    - Be conversational and direct.
    - If the driver is drowsy, prioritize safety advice (e.g., take a break).
    - If the driver asks for demand info, use the provided context.
    
    ASSISTANT RESPONSE:
    """
    
    try:
        # Simplified inference call for AirLLM
        input_tokens = model.tokenizer(prompt, return_tensors="pt")
        output = model.generate(input_tokens, max_new_tokens=50)
        response = model.tokenizer.decode(output[0], skip_special_tokens=True)
        
        # Extract the response after the prompt
        if "ASSISTANT RESPONSE:" in response:
            response = response.split("ASSISTANT RESPONSE:")[-1].strip()
            
        return response, "airllm"
    except Exception as e:
        print(f"Inference error: {e}")
        return "I'm monitoring the grid and your alertness. Stay safe.", "fallback"

def generate_drowsiness_guidance(update):
    """
    Specifically generates a response when drowsiness is detected.
    """
    severity = update.get("severity")
    if severity == "normal":
        return None, "idle"
        
    status = update.get("status")
    
    # We can use a simpler prompt or even a few-shot approach here
    advice_map = {
        "critical": "You seem very tired! Please pull over safely and take a 10-minute break. Your safety is more important than the next fare.",
        "warning": "I noticed some long blinks. Maybe it's time for a quick splash of water or a coffee break soon?"
    }
    
    response = advice_map.get(severity, "I'm monitoring your alertness. Please stay focused.")
    
    # Optionally use LLM to vary the advice
    return response, "local_logic"

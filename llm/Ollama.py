# LiveTalking/llm/Ollama.py
import requests

class Ollama:
    def __init__(self, model_name):
        self.model_name = model_name
        self.api_base = "http://localhost:11434"
        
    def chat(self, prompt):
        try:
            response = requests.post(
                f"{self.api_base}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False
                }
            )
            response.raise_for_status()
            result = response.json()
            return result.get('response', "抱歉，我现在无法回答这个问题。")
        except Exception as e:
            print(f"Ollama API error: {str(e)}")
            return "抱歉，我现在无法回答这个问题。"

    def get_models(self):
        try:
            response = requests.get(f"{self.api_base}/api/tags")
            response.raise_for_status()
            result = response.json()
            return [model['name'] for model in result['models']]
        except Exception as e:
            print(f"Ollama API error: {str(e)}")
            return []
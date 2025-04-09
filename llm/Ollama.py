# LiveTalking/llm/Ollama.py
import requests
import json
import logging

logger = logging.getLogger(__name__)

class Ollama:
    def __init__(self, model_name):
        self.model_name = model_name
        self.api_base = "http://192.168.0.64:11434"
        
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
            logger.error(f"Ollama API error: {str(e)}")
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

    def chat_stream(self, prompt):
        try:
            response = requests.post(
                f"{self.api_base}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": True
                },
                stream=True
            )
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    try:
                        chunk = json.loads(decoded_line)
                        if 'response' in chunk:
                            yield chunk['response']
                    except json.JSONDecodeError:
                        pass      
        except Exception as e:
            print(f"Ollama API error: {str(e)}")
            yield "抱歉，我现在无法回答这个问题。"

    def clean_text(self, text):
        # 清理文本
        text = text.replace('*', '')  # 移除星号
        text = text.replace('\r', '')  # 移除回车符
        text = text.replace('\n\n', '\n')  # 将多个换行符替换为单个
        text = text.strip()  # 移除首尾空白
        return text
# LiveTalking/llm/Ollama.py
import requests
import json
import logging

logger = logging.getLogger(__name__)

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
            response.raise_for_status()
            
            current_paragraph = ""
            for line in response.iter_lines():
                if line:
                    json_response = json.loads(line)
                    if 'response' in json_response:
                        text = json_response['response']
                        # 清理文本
                        text = self.clean_text(text)
                        current_paragraph += text
                        
                        # 遇到段落结束符时返回
                        if text.endswith(('.', '。', '!', '！', '?', '？', '\n')):
                            if current_paragraph.strip():
                                yield current_paragraph.strip()
                                current_paragraph = ""
            
            # 确保最后的文本也被发送
            if current_paragraph.strip():
                yield current_paragraph.strip()
            
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
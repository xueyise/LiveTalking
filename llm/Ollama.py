# LiveTalking/llm/Ollama.py
import requests
import json
import logging
import time
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
            # 记录请求开始时间
            start_time = time.time()
            logger.info(f"Starting Ollama stream request for prompt: {prompt}")

            # 发送流式请求
            response = requests.post(
                f"{self.api_base}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": True
                },
                stream=True
            )
            # 检查响应状态码
            response.raise_for_status()

            # 逐行处理响应
            for line in response.iter_lines():
                if line:
                    try:
                        decoded_line = line.decode('utf-8')
                        chunk = json.loads(decoded_line)
                        if 'response' in chunk:
                            # 记录每个数据块的信息
                            logger.info(f"Received chunk of size {len(chunk['response'])} from Ollama")
                            yield chunk['response']
                    except json.JSONDecodeError as json_error:
                        # 记录 JSON 解析错误信息
                        logger.error(f"JSON decoding error in Ollama response: {json_error}, line: {line}")
                    except Exception as general_error:
                        # 记录其他异常信息
                        logger.error(f"General error processing Ollama response: {general_error}, line: {line}")

            # 记录请求结束时间
            end_time = time.time()
            logger.info(f"Ollama stream request completed in {end_time - start_time} seconds")

        except requests.RequestException as request_error:
            # 记录请求异常信息
            logger.error(f"Request error in Ollama stream: {request_error}")
            yield "抱歉，我现在无法回答这个问题。"
        except Exception as e:
            # 记录其他异常信息
            logger.error(f"Unexpected error in Ollama stream: {e}")
            yield "抱歉，我现在无法回答这个问题。"

    def clean_text(self, text):
        # 清理文本
        text = text.replace('*', '')  # 移除星号
        text = text.replace('\r', '')  # 移除回车符
        text = text.replace('\n\n', '\n')  # 将多个换行符替换为单个
        text = text.strip()  # 移除首尾空白
        return text
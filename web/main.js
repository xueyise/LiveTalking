class DigitalHumanChat {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.isConnected = false;
        this.sessionId = null;  // 初始化为 null
        this.pc = null;
        
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.attachEventListeners();
    }

    initializeElements() {
        this.elements = {
            startBtn: document.getElementById('start'),
            stopBtn: document.getElementById('stop'),
            videoPlayer: document.getElementById('video'),
            connectionStatus: document.getElementById('connectionStatus'),
            chatForm: document.getElementById('chat-form'),
            chatMessage: document.getElementById('chat-message'),
            voiceRecordBtn: document.getElementById('voice-record-btn'),
            modelSelect: document.getElementById('modelSelect'),
            autoScroll: document.getElementById('autoScroll'),
            soundEffect: document.getElementById('soundEffect'),
            interruptible: document.getElementById('interruptible'),
            useStun: document.getElementById('use-stun')
        };
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'zh-CN';
            
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    this.sendMessage(finalTranscript);
                }
            };
        }
    }

    attachEventListeners() {
        // 开始按钮事件
        this.elements.startBtn.addEventListener('click', () => {
            this.updateConnectionStatus('connecting');
            this.start();
            this.elements.startBtn.style.display = 'none';
            this.elements.stopBtn.style.display = 'block';
        });

        // 停止按钮事件
        this.elements.stopBtn.addEventListener('click', () => {
            this.stop();
            this.elements.stopBtn.style.display = 'none';
            this.elements.startBtn.style.display = 'block';
        });

        // 聊天表单提交
        if (this.elements.chatForm) {
            this.elements.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const message = this.elements.chatMessage.value.trim();
                if (message) {
                    this.sendMessage(message);
                    this.elements.chatMessage.value = '';
                }
            });
        }

        // 语音按钮事件
        if (this.elements.voiceRecordBtn) {
            this.elements.voiceRecordBtn.addEventListener('mousedown', () => this.startRecording());
            this.elements.voiceRecordBtn.addEventListener('mouseup', () => this.stopRecording());
            this.elements.voiceRecordBtn.addEventListener('mouseleave', () => this.stopRecording());
        }
    }

    updateConnectionStatus(status) {
        const statusElement = this.elements.connectionStatus;
        switch (status) {
            case 'connecting':
                statusElement.className = 'alert alert-warning';
                statusElement.textContent = '正在连接...';
                break;
            case 'connected':
                statusElement.className = 'alert alert-success';
                statusElement.textContent = `已连接 (会话ID: ${this.sessionId})`;
                break;
            case 'disconnected':
                statusElement.className = 'alert alert-secondary';
                statusElement.textContent = '已断开连接';
                break;
            case 'error':
                statusElement.className = 'alert alert-danger';
                statusElement.textContent = '连接失败';
                break;
        }
    }

    async start() {
        try {
            this.updateConnectionStatus('connecting');
            
            // 获取会话ID
            const sessionResponse = await fetch('/session');
            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text();
                console.error('Session response:', errorText);
                throw new Error(`服务器错误: ${errorText}`);
            }
            
            const sessionData = await sessionResponse.json();
            if (sessionData.code === 0) {
                this.sessionId = sessionData.data.sessionid;
                console.log('Successfully got session ID:', this.sessionId);
            } else {
                throw new Error(sessionData.error || 'Failed to get session ID');
            }

            // WebRTC 连接配置
            const config = this.elements.useStun.checked ? 
                { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] } : 
                null;
            
            this.pc = new RTCPeerConnection(config);

            // 处理远程流
            this.pc.addEventListener('track', (evt) => {
                if (evt.track.kind === 'video') {
                    this.elements.videoPlayer.srcObject = evt.streams[0];
                }
            });

            // 创建 SDP offer
            const offer = await this.pc.createOffer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true
            });
            await this.pc.setLocalDescription(offer);

            // 发送 offer 到服务器并获取应答
            const response = await fetch('/offer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type,
                    video_transform: 'none',
                    sessionid: this.sessionId  // 添加会话ID
                })
            });

            const answer = await response.json();
            await this.pc.setRemoteDescription(answer);

            // 添加定时器检查视频流是否已加载
            let connectionCheckTimer = setInterval(() => {
                if (this.elements.videoPlayer.readyState >= 3 && 
                    this.elements.videoPlayer.videoWidth > 0) {
                    this.updateConnectionStatus('connected');
                    this.isConnected = true;
                    clearInterval(connectionCheckTimer);
                }
            }, 2000);

            // 60秒后如果还是连接中状态，就停止检查
            setTimeout(() => {
                if (connectionCheckTimer) {
                    clearInterval(connectionCheckTimer);
                    if (!this.isConnected) {
                        this.updateConnectionStatus('error');
                    }
                }
            }, 60000);

        } catch (error) {
            console.error('Connection failed:', error);
            this.updateConnectionStatus('error');
            this.showError('连接失败: ' + error.message);
            this.stop();
        }
    }

    stop() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        if (this.elements.videoPlayer.srcObject) {
            this.elements.videoPlayer.srcObject.getTracks().forEach(track => track.stop());
            this.elements.videoPlayer.srcObject = null;
        }
        this.isConnected = false;
        this.sessionId = null;  // 清除会话ID
        this.updateConnectionStatus('disconnected');
        this.elements.stopBtn.style.display = 'none';
        this.elements.startBtn.style.display = 'block';
    }

    startRecording() {
        if (!this.isConnected || !this.recognition) return;
        this.isRecording = true;
        this.elements.voiceRecordBtn.classList.add('recording');
        this.recognition.start();
    }

    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;
        this.elements.voiceRecordBtn.classList.remove('recording');
        this.recognition.stop();
    }

    async sendMessage(text, type = 'chat') {
        if (!text.trim() || !this.isConnected || this.sessionId === null) {
            this.showError('未连接或会话无效');
            return;
        }

        try {
            const response = await fetch('/human', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    type: type,
                    interrupt: this.elements.interruptible?.checked ?? true,
                    sessionid: this.sessionId,
                    model: 'ollama'  // 使用ollama模型
                })
            });

            const data = await response.json();

            if (!response.ok || data.code !== 0) {
                throw new Error(data.error || '发送消息失败');
            }

            // 添加用户消息到对话框
            this.addMessage(text, 'user');

            // 如果有响应文本，添加数字人的回复并直接朗读
            if (data.data && data.data.response) {
                this.addMessage(data.data.response, 'bot');
                // 直接发送TTS请求朗读响应内容
                await this.sendMessage(data.data.response, 'echo');
            }
            
            // 播放提示音
            if (this.elements.soundEffect?.checked) {
                this.playMessageSound();
            }
        } catch (error) {
            console.error('Message error:', error);
            this.showError('发送消息失败: ' + error.message);
        }
    }

    addMessage(message, type = 'user') {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // 添加时间戳
        const timestamp = new Date().toLocaleTimeString();
        const sender = type === 'user' ? '您' : '数字人';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">${sender}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${message}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        
        if (this.elements.autoScroll?.checked) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    showError(message) {
        console.error('Error:', message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.innerHTML = `
            <strong>错误:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.firstChild);
        
        // 3秒后自动消失
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    playMessageSound() {
        // 可以在这里添加提示音效
        const audio = new Audio('static/sound/message.mp3');
        audio.play().catch(() => {});
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.digitalHumanChat = new DigitalHumanChat();
}); 
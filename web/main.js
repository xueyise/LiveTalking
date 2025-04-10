$(document).ready(function () {
    $('#video-size-slider').on('input', function () {
        const value = $(this).val();
        $('#video-size-value').text(value + '%');
        $('#video').css('width', value + '%');
    });
    function updateConnectionStatus(status) {
        const statusIndicator = $('#connection-status');
        const statusText = $('#status-text');

        statusIndicator.removeClass('status-connected status-disconnected status-connecting');

        switch (status) {
            case 'connected':
                statusIndicator.addClass('status-connected');
                statusText.text('已连接');
                break;
            case 'connecting':
                statusIndicator.addClass('status-connecting');
                statusText.text('连接中...');
                break;
            case 'disconnected':
            default:
                statusIndicator.addClass('status-disconnected');
                statusText.text('未连接');
                break;
        }
    }

    async function sentmesg() {
        var message = $('#chat-message').val();
        if (!message.trim()) return;

        // 添加用户消息
        addChatMessage(message, 'user');
        $('#chat-message').val('');

        try {
            // 先创建一个空的机器人回复消息
            const botMessageId = addChatMessage('...', 'bot', true);

            const response = await fetch('/human', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: message,
                    type: 'chat',
                    interrupt: true,
                    sessionid: parseInt(document.getElementById('sessionid').value),
                    model: currentModel || 'qwen2.5:7b'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';

            // while (true) {
            //     const { done, value } = await reader.read();
            //     if (done) break;
            //     const chunk = decoder.decode(value);
            //     chunk.split('\n').forEach(line => {
            //         if (line.startsWith('data: ')) {
            //             try {
            //                 const data = JSON.parse(line.substring(6));
            //                 console.log('Received data:', data);
            //                 if (data.response) {
            //                     result += data.response;
            //                 }
            //             } catch (e) {
            //                 console.error('解析错误:', e);
            //             }
            //         }
            //     });
            //     // fetch('/human', {
            //     //     body: JSON.stringify({
            //     //         text: chunk,
            //     //         type: 'echo',
            //     //         interrupt: true,
            //     //         sessionid: parseInt(document.getElementById('sessionid').value),
            //     //     }),
            //     //     headers: {
            //     //         'Content-Type': 'application/json'
            //     //     },
            //     //     method: 'POST'
            //     // });
            //     // 更新现有消息而不是创建新消息
            //     updateChatMessage(botMessageId, result);
            // }

            let incompleteSentence = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 处理最后可能剩余的不完整句子
                    if (incompleteSentence) {
                        incompleteSentence = incompleteSentence.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s.,?!，。？！]/g, '');
                        await fetch('/human', {
                            body: JSON.stringify({
                                text: incompleteSentence,
                                type: 'echo',
                                interrupt: true,
                                sessionid: parseInt(document.getElementById('sessionid').value),
                            }),
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            method: 'POST'
                        });
                    }
                    break;
                }
                const chunk = decoder.decode(value);
                chunk.split('\n').forEach(line => {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            console.log('Received data:', data);
                            if (data.response) {
                                // 拼接不完整的句子
                                result += data.response;
                                incompleteSentence += data.response;
                                incompleteSentence = incompleteSentence.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s.,?!，。？！]/g, '');
                                // 定义句子结束的标点符号
                                const endPunctuations = ['.', '?', '!', '。', '？', '！'];
                                while (endPunctuations.some(p => incompleteSentence.includes(p))) {
                                    // 找到第一个句子结束的位置
                                    let endIndex = -1;
                                    for (const p of endPunctuations) {
                                        const index = incompleteSentence.indexOf(p);
                                        if (index !== -1 && (endIndex === -1 || index < endIndex)) {
                                            endIndex = index;
                                        }
                                    }
                                    if (endIndex !== -1) {
                                        // 提取完整的句子
                                        const sentence = incompleteSentence.slice(0, endIndex + 1);
                                        // 调用 fetch 函数处理完整句子
                                        fetch('/human', {
                                            body: JSON.stringify({
                                                text: sentence,
                                                type: 'echo',
                                                interrupt: true,
                                                sessionid: parseInt(document.getElementById('sessionid').value),
                                            }),
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            method: 'POST'
                                        });
                                        // 移除已处理的句子
                                        incompleteSentence = incompleteSentence.slice(endIndex + 1);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('解析错误:', e);
                        }
                        updateChatMessage(botMessageId, result);
                    }

                });
               
            }
        } catch (error) {
            console.error('Error:', error);
            addChatMessage('发送消息失败，请重试', 'system');
        }
    }
    $('#chat-message').on('keypress', async function (e) {
        if (e.which === 13) {  // 13 是 Enter 键的 keyCode
            e.preventDefault();  // 阻止默认行为（如表单提交）
            sentmesg();
        }
    });
    // 修改发送消息的处理函数
    $('#chat-form').on('submit', async function (e) {
        e.preventDefault();
        sentmesg();
    });

    // 添加新函数来创建和更新聊天消息
    function addChatMessage(message, type = 'user', returnId = false) {
        const messagesContainer = $('#chat-messages');
        const messageClass = type === 'user' ? 'user-message' : (type === 'system' ? 'system-message' : 'bot-message');
        const sender = type === 'user' ? '您' : (type === 'system' ? '系统' : '数字人');

        // 生成唯一ID
        const messageId = 'msg-' + Date.now();

        const messageElement = $(`
            <div id="${messageId}" class="message ${messageClass}">
                <div class="message-content">
                    <span class="message-sender">${sender}</span>
                    <span class="message-text">${message}</span>
                </div>
            </div>
        `);

        messagesContainer.append(messageElement);
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);

        // 如果需要返回消息ID
        if (returnId) {
            return messageId;
        }
    }

    // 更新现有消息的内容
    function updateChatMessage(messageId, content) {
        // 更新消息文本
        $(`#${messageId} .message-text`).text(content);

        // 滚动到底部
        const messagesContainer = $('#chat-messages');
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    }

    // 开始/停止按钮
    $('#start').click(function () {
        updateConnectionStatus('connecting');
        start();
        $(this).hide();
        $('#stop').show();

        // 添加定时器检查视频流是否已加载
        let connectionCheckTimer = setInterval(function () {
            const video = document.getElementById('video');
            // 检查视频是否有数据
            if (video.readyState >= 3 && video.videoWidth > 0) {
                updateConnectionStatus('connected');
                clearInterval(connectionCheckTimer);
            }
        }, 2000); // 每2秒检查一次

        // 60秒后如果还是连接中状态，就停止检查
        setTimeout(function () {
            if (connectionCheckTimer) {
                clearInterval(connectionCheckTimer);
            }
        }, 60000);
    });

    $('#stop').click(function () {
        stop();
        $(this).hide();
        $('#start').show();
        updateConnectionStatus('disconnected');
    });

    // 录制功能
    $('#btn_start_record').click(function () {
        console.log('Starting recording...');
        fetch('/record', {
            body: JSON.stringify({
                type: 'start_record',
                sessionid: parseInt(document.getElementById('sessionid').value),
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        }).then(function (response) {
            if (response.ok) {
                console.log('Recording started.');
                $('#btn_start_record').prop('disabled', true);
                $('#btn_stop_record').prop('disabled', false);
                $('#recording-indicator').addClass('active');
            } else {
                console.error('Failed to start recording.');
            }
        }).catch(function (error) {
            console.error('Error:', error);
        });
    });

    $('#btn_stop_record').click(function () {
        console.log('Stopping recording...');
        fetch('/record', {
            body: JSON.stringify({
                type: 'end_record',
                sessionid: parseInt(document.getElementById('sessionid').value),
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        }).then(function (response) {
            if (response.ok) {
                console.log('Recording stopped.');
                $('#btn_start_record').prop('disabled', false);
                $('#btn_stop_record').prop('disabled', true);
                $('#recording-indicator').removeClass('active');
            } else {
                console.error('Failed to stop recording.');
            }
        }).catch(function (error) {
            console.error('Error:', error);
        });
    });

    // 按住说话功能
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let recognition;

    // 检查浏览器是否支持语音识别
    const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

    if (isSpeechRecognitionSupported) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onresult = function (event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                    $('#chat-message').val(interimTranscript);
                }
            }

            if (finalTranscript) {
                $('#chat-message').val(finalTranscript);
            }
        };

        recognition.onerror = function (event) {
            console.error('语音识别错误:', event.error);
        };
    }

    // 按住说话按钮事件
    $('#voice-record-btn').on('mousedown touchstart', function (e) {
        e.preventDefault();
        startRecording();
    }).on('mouseup mouseleave touchend', function () {
        if (isRecording) {
            stopRecording();
        }
    });

    // 开始录音
    function startRecording() {
        if (isRecording) return;

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (stream) {
                audioChunks = [];
                mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = function (e) {
                    if (e.data.size > 0) {
                        audioChunks.push(e.data);
                    }
                };

                mediaRecorder.start();
                isRecording = true;

                $('#voice-record-btn').addClass('recording-pulse');
                $('#voice-record-btn').css('background-color', '#dc3545');

                if (recognition) {
                    recognition.start();
                }
            })
            .catch(function (error) {
                console.error('无法访问麦克风:', error);
                alert('无法访问麦克风，请检查浏览器权限设置。');
            });
    }

    function stopRecording() {
        if (!isRecording) return;

        mediaRecorder.stop();
        isRecording = false;

        // 停止所有音轨
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        // 视觉反馈恢复
        $('#voice-record-btn').removeClass('recording-pulse');
        $('#voice-record-btn').css('background-color', '');

        // 停止语音识别
        if (recognition) {
            recognition.stop();
        }

        // 获取识别的文本并发送
        setTimeout(function () {
            const recognizedText = $('#chat-message').val().trim();
            if (recognizedText) {
                // 发送识别的文本
                fetch('/human', {
                    body: JSON.stringify({
                        text: recognizedText,
                        type: 'chat',
                        interrupt: true,
                        sessionid: parseInt(document.getElementById('sessionid').value),
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    method: 'POST'
                });

                addChatMessage(recognizedText, 'user');
                $('#chat-message').val('');
            }
        }, 500);
    }

    // WebRTC 相关功能
    if (typeof window.onWebRTCConnected === 'function') {
        const originalOnConnected = window.onWebRTCConnected;
        window.onWebRTCConnected = function () {
            updateConnectionStatus('connected');
            if (originalOnConnected) originalOnConnected();
        };
    } else {
        window.onWebRTCConnected = function () {
            updateConnectionStatus('connected');
        };
    }

    // 当连接断开时更新状态
    if (typeof window.onWebRTCDisconnected === 'function') {
        const originalOnDisconnected = window.onWebRTCDisconnected;
        window.onWebRTCDisconnected = function () {
            updateConnectionStatus('disconnected');
            if (originalOnDisconnected) originalOnDisconnected();
        };
    } else {
        window.onWebRTCDisconnected = function () {
            updateConnectionStatus('disconnected');
        };
    }

    // SRS WebRTC播放功能
    var sdk = null; // 全局处理器，用于在重新发布时进行清理

    function startPlay() {
        // 关闭之前的连接
        if (sdk) {
            sdk.close();
        }

        sdk = new SrsRtcWhipWhepAsync();
        $('#video').prop('srcObject', sdk.stream);

        var host = window.location.hostname;
        var url = "http://" + host + ":1985/rtc/v1/whep/?app=live&stream=livestream";

        sdk.play(url).then(function (session) {
            console.log('WebRTC播放已启动，会话ID:', session.sessionid);
        }).catch(function (reason) {
            sdk.close();
            console.error('WebRTC播放失败:', reason);
        });
    }

    // 添加在现有 JavaScript 代码中
    let currentModel = localStorage.getItem('selectedModel') || '';
    const settingsModal = new bootstrap.Modal(document.getElementById('settings-modal'));

    // 加载模型列表
    function loadModels() {
        fetch('/models')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.code === 0 && data.data.models) {
                    const models = data.data.models;
                    updateModelSelects(models);

                    // 如果没有存储的模型或存储的模型不在列表中，使用第一个模型
                    if (!currentModel || !models.includes(currentModel)) {
                        currentModel = models[0] || '';
                        localStorage.setItem('selectedModel', currentModel);
                    }

                    updateCurrentModelDisplay();
                }
            })
            .catch(error => {
                console.error('Error loading models:', error);
                updateModelSelects([]);
                currentModel = '';
                updateCurrentModelDisplay();
            });
    }

    // 更新所有模型选择框
    function updateModelSelects(models) {
        const modalSelect = $('#model-select-modal');
        const mainSelect = $('#model-select');

        [modalSelect, mainSelect].forEach(select => {
            select.empty();

            if (models.length === 0) {
                select.append($('<option>', {
                    value: '',
                    text: '未找到可用模型'
                }));
            } else {
                models.forEach(model => {
                    select.append($('<option>', {
                        value: model,
                        text: model
                    }));
                });
            }

            // 设置当前选中的模型
            select.val(currentModel);
        });
    }

    // 更新当前模型显示
    function updateCurrentModelDisplay() {
        $('#current-model').text(`当前模型: ${currentModel || '未选择'}`);
    }

    // 设置按钮点击事件
    $('#settings-btn').click(function () {
        $('#model-select-modal').val(currentModel);
        settingsModal.show();
    });

    // 保存设置
    $('#save-settings').click(function () {
        const newModel = $('#model-select-modal').val();
        if (newModel) {
            currentModel = newModel;
            localStorage.setItem('selectedModel', currentModel);
            updateCurrentModelDisplay();
            settingsModal.hide();
        } else {
            alert('请选择一个模型');
        }
    });

    // 页面加载完成后执行
    loadModels();  // 加载模型列表
    setInterval(loadModels, 60000);  // 每60秒刷新一次

    // 添加 favicon 处理
    $('head').append('<link rel="icon" href="data:;base64,iVBORw0KGgo=">');
});
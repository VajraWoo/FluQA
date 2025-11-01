document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取所有需要的DOM元素
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const micBtn = document.getElementById('mic-btn');
    const welcomeView = document.getElementById('welcome-view');
    const newChatBtn = document.getElementById('new-chat-btn');
    const historyList = document.getElementById('history-list');
    const quickPromptsContainer = document.getElementById('quick-prompts');
    const knowledgeBaseList = document.getElementById('knowledge-base-list');
    const originalPlaceholder = userInput.placeholder;

    // 2. API 地址
    const API_URL = 'http://localhost:8080/api/ask';
    const UPLOAD_API_URL = 'http://localhost:8080/api/upload';

    // 3. 状态管理变量
    let currentChatId = null;
    let chatHistory = {};
    let knowledgeBaseFiles = [];

    // 4. 核心功能函数
    // --- 数据持久化 (localStorage) ---
    function loadHistoryFromStorage() {
        const storedHistory = localStorage.getItem('flu_chat_history');
        if (storedHistory) {
            chatHistory = JSON.parse(storedHistory);
            renderHistoryList();
        }
    }
    function saveHistoryToStorage() {
        localStorage.setItem('flu_chat_history', JSON.stringify(chatHistory));
    }
    function loadKnowledgeBaseFromStorage() {
        const storedFiles = localStorage.getItem('flu_knowledge_files');
        if (storedFiles) {
            knowledgeBaseFiles = JSON.parse(storedFiles);
            renderKnowledgeBaseList();
        }
    }
    function saveKnowledgeBaseToStorage() {
        localStorage.setItem('flu_knowledge_files', JSON.stringify(knowledgeBaseFiles));
    }

    // --- 侧边栏渲染 ---
    function renderKnowledgeBaseList() {
        knowledgeBaseList.innerHTML = '';
        if (knowledgeBaseFiles.length === 0) {
            knowledgeBaseList.innerHTML = '<li><i class="fas fa-info-circle"></i> 暂无知识文件</li>';
        } else {
            knowledgeBaseFiles.forEach(fileName => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <i class="fas fa-file-alt"></i>
                    <span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis;">${fileName}</span>
                    <button class="action-btn delete-kb-btn" data-filename="${fileName}" title="删除文件">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                knowledgeBaseList.appendChild(li);
            });
        }
    }

    function renderHistoryList() {
        historyList.innerHTML = '';
        Object.keys(chatHistory).sort((a, b) => b.split('_')[1] - a.split('_')[1]).forEach(chatId => {
            const chat = chatHistory[chatId];
            const li = document.createElement('li');
            const titleSpan = document.createElement('span');
            titleSpan.textContent = chat.title;
            titleSpan.style.flexGrow = '1';
            titleSpan.style.overflow = 'hidden';
            titleSpan.style.textOverflow = 'ellipsis';

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'history-item-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn';
            editBtn.title = '重命名';
            editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn';
            deleteBtn.title = '删除聊天';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);

            li.appendChild(titleSpan);
            li.appendChild(actionsDiv);
            li.dataset.chatId = chatId;
            if (chatId === currentChatId) li.classList.add('active');

            li.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                switchChat(chatId);
            });

            editBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = chat.title;
                input.className = 'history-title-input';
                li.replaceChild(input, titleSpan);
                input.focus();
                input.select();
                const saveTitle = () => {
                    const newTitle = input.value.trim();
                    if (newTitle) {
                        chatHistory[chatId].title = newTitle;
                        saveHistoryToStorage();
                    }
                    renderHistoryList();
                };
                input.addEventListener('blur', saveTitle);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') renderHistoryList();
                });
            });

            deleteBtn.addEventListener('click', () => {
                if (confirm(`确定要删除聊天 "${chat.title}" 吗？`)) {
                    delete chatHistory[chatId];
                    saveHistoryToStorage();
                    if (currentChatId === chatId) {
                        startNewChat();
                    } else {
                        renderHistoryList();
                    }
                }
            });

            historyList.appendChild(li);
        });
    }

    // --- 聊天控制 ---
    function startNewChat() {
        currentChatId = null;
        chatBox.innerHTML = '';
        if (welcomeView) {
            chatBox.appendChild(welcomeView);
            welcomeView.classList.remove('hidden');
        }
        renderHistoryList();
    }
    function switchChat(chatId) {
        currentChatId = chatId;
        const chat = chatHistory[chatId];
        chatBox.innerHTML = '';
        if (welcomeView) welcomeView.classList.add('hidden');
        chat.messages.forEach(msg => {
            appendMessage(msg.text, msg.type, false, true);
        });
        renderHistoryList();
    }
    async function sendMessage() {
        const question = userInput.value.trim();
        if (!question) return;
        if (!currentChatId) {
            currentChatId = `chat_${Date.now()}`;
            chatHistory[currentChatId] = { title: question.length > 20 ? question.substring(0, 20) + '...' : question, messages: [] };
            if (welcomeView) welcomeView.classList.add('hidden');
            renderHistoryList();
        }
        addMessageToHistory(question, 'user');
        appendMessage(question, 'user');
        userInput.value = '';
        appendMessage('...', 'bot', true);
        try {
            const answer = await getMockResponse(question);
            removeTypingIndicator();
            addMessageToHistory(answer, 'bot');
            appendMessage(answer, 'bot');
            saveHistoryToStorage();
        } catch (error) {
            console.error('API 出错:', error);
            removeTypingIndicator();
            appendMessage('抱歉，服务出现了一点问题。', 'bot');
        }
    }
    function addMessageToHistory(text, type) {
        if (chatHistory[currentChatId]) {
            chatHistory[currentChatId].messages.push({ text, type });
        }
    }
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (welcomeView) welcomeView.classList.add('hidden');
        if (!currentChatId) startNewChat();
        appendMessage(`正在上传文件: ${file.name}`, 'user');
        appendMessage('...', 'bot', true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!knowledgeBaseFiles.includes(file.name)) {
                knowledgeBaseFiles.push(file.name);
                saveKnowledgeBaseToStorage();
                renderKnowledgeBaseList();
            }
            removeTypingIndicator();
            appendMessage(`文件 "${file.name}" 上传成功！知识库已更新。`, 'bot');
        } catch (error) {
            removeTypingIndicator();
            appendMessage(`文件上传失败: ${error.message}`, 'bot');
            console.error('上传出错:', error);
        }
        fileInput.value = '';
    }

    // --- UI & 辅助函数 ---
    function appendMessage(text, type, isTyping = false, noAnimation = false) {
        if (welcomeView) welcomeView.classList.add('hidden');
        const messageDiv = document.createElement('div');
        if (!noAnimation) {
            messageDiv.style.animation = 'fadeIn 0.4s ease-in-out';
        }
        messageDiv.classList.add('message', `${type}-message`);
        const iconDiv = document.createElement('div');
        iconDiv.classList.add('message-icon');
        iconDiv.innerHTML = (type === 'user') ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        const p = document.createElement('p');
        if (isTyping) {
            messageDiv.classList.add('typing-indicator');
            p.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        } else {
            p.textContent = text;
        }
        messageDiv.appendChild(iconDiv);
        messageDiv.appendChild(p);
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    function removeTypingIndicator() {
        const typingIndicator = chatBox.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    function getMockResponse(question) {
        return new Promise(resolve => {
            setTimeout(() => {
                let mockAnswer = "";
                if (question.includes("你好")) {
                    mockAnswer = "你好！这是一个来自前端的模拟回答。";
                } else if (question.includes("症状")) {
                    mockAnswer = "模拟回答：流感的常见症状包括发烧、咳嗽、喉咙痛、身体酸痛等。";
                } else if (question.includes("预防")) {
                    mockAnswer = "模拟回答：预防流感最好的方式是接种疫苗、勤洗手、避免触摸口鼻眼。";
                } else {
                    mockAnswer = `关于 “${question}” 的问题，我暂时无法回答。当后端API对接好后，我会变得更聪明。`;
                }
                resolve(mockAnswer);
            }, 1000);
        });
    }

    // 5. 事件监听器
    newChatBtn.addEventListener('click', startNewChat);
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') sendMessage(); });
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    quickPromptsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('quick-prompt-btn')) {
            const prompt = event.target.textContent;
            userInput.value = prompt;
            sendMessage();
        }
    });
    knowledgeBaseList.addEventListener('click', (event) => {
        const deleteBtn = event.target.closest('.delete-kb-btn');
        if (deleteBtn) {
            const fileNameToDelete = deleteBtn.dataset.filename;
            if (confirm(`确定要删除知识文件 "${fileNameToDelete}" 吗？`)) {
                knowledgeBaseFiles = knowledgeBaseFiles.filter(name => name !== fileNameToDelete);
                saveKnowledgeBaseToStorage();
                renderKnowledgeBaseList();
            }
        }
    });

    // --- 语音识别 (终极诊断版) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('is-listening')) {
                recognition.stop();
            } else {
                try { recognition.start(); } catch (e) {
                    console.error("语音识别启动失败:", e);
                    appendMessage("启动语音识别失败，可能麦克风权限被阻止或设备不支持。", 'bot');
                }
            }
        });

        recognition.onstart = () => {
            micBtn.classList.add('is-listening');
            userInput.placeholder = "正在聆听...";
        };

        recognition.onend = () => {
            micBtn.classList.remove('is-listening');
            userInput.placeholder = originalPlaceholder;
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript.trim()) {
                userInput.value = transcript;
                setTimeout(sendMessage, 300);
            }
        };

        recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            let errorMessage = "语音识别发生未知错误。请检查F12控制台。";
            if (event.error === 'no-speech') {
                errorMessage = "未检测到语音，请靠近麦克风再说一次。";
            } else if (event.error === 'audio-capture') {
                errorMessage = "无法获取麦克风音频，请检查设备是否正常连接。";
            } else if (event.error === 'not-allowed') {
                errorMessage = "麦克风权限已被阻止。请点击浏览器地址栏左侧的锁🔒图标，允许此网站使用麦克风。";
            }
            appendMessage(errorMessage, 'bot');
        };
    } else {
        micBtn.style.display = 'none';
    }

    // 6. 初始化
    loadHistoryFromStorage();
    loadKnowledgeBaseFromStorage();
});
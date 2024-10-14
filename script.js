document.addEventListener('DOMContentLoaded', function () {
    const chatForm = document.getElementById('chat-form');
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelection = document.getElementById('model-selection');
    const temperatureInput = document.getElementById('temperature');
    const topPInput = document.getElementById('top_p');
    const maxTokensInput = document.getElementById('max_tokens');
    const safeModeInput = document.getElementById('safe_mode');
    const randomSeedInput = document.getElementById('random_seed');
    let conversationHistory = [];

    const advancedOptionsButton = document.getElementById('burger-button');
    const advancedOptionsOverlay = document.getElementById('advanced-options');
    const offcanvas = new bootstrap.Offcanvas(advancedOptionsOverlay);

    advancedOptionsButton.addEventListener('click', function () {
        offcanvas.show();
    });

    advancedOptionsOverlay.querySelector('.btn-close').addEventListener('click', function () {
        offcanvas.hide();
    });

    function fetchModels() {
        const apiKey = apiKeyInput.value;
        fetch('https://api.mistral.ai/v1/models', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
        })
            .then(response => response.json())
            .then(data => {
                populateModelSelection(data.data);
            })
            .catch(error => {
                console.error('Error:', error);
                showErrorToast(`Error fetching models: ${error.message}`);
            });
    }

    function populateModelSelection(models) {
        modelSelection.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            modelSelection.appendChild(option);
        });
    }

    function appendMessage(text, isUser = false) {
        const messageElement = document.createElement('div');
        messageElement.className = isUser ? 'user-message' : 'assistant-message';

        const messageContent = document.createElement('div');
        messageContent.textContent = text;
        messageContent.className = 'message-content';

        messageElement.appendChild(messageContent);
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        return messageContent;
    }

    chatForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const userMessage = userInput.value.trim();
        if (userMessage) {
            appendMessage(userMessage, true);
            userInput.value = '';

            const apiKey = apiKeyInput.value;
            conversationHistory.push({ role: 'user', content: userMessage });

            const requestBody = {
                model: modelSelection.value,
                messages: conversationHistory,
                temperature: parseFloat(temperatureInput.value),
                top_p: parseFloat(topPInput.value),
                random_seed: parseInt(randomSeedInput.value),
                stream: true
            };

            if (maxTokensInput.value) {
                requestBody.max_tokens = parseInt(maxTokensInput.value);
            }

            fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
            })
                .then(response => {
                    const reader = response.body.getReader();
                    let accumulatedResponse = '';

                    function readChunk() {
                        return reader.read().then(({ done, value }) => {
                            if (done) {
                                return;
                            }

                            accumulatedResponse += new TextDecoder("utf-8").decode(value);

                            try {
                                let newlineIndex;
                                while ((newlineIndex = accumulatedResponse.indexOf('\n')) !== -1) {
                                    const line = accumulatedResponse.slice(0, newlineIndex);
                                    accumulatedResponse = accumulatedResponse.slice(newlineIndex + 1);

                                    if (line.startsWith('data: ')) {
                                        const data = JSON.parse(line.slice(6));

                                        if (data.choices[0].delta.role === 'assistant') {
                                            conversationHistory.push({ role: 'assistant', content: data.choices[0].delta.content || '' });
                                            appendMessage(data.choices[0].delta.content, false);
                                        } else if (data.choices[0].delta.role === null) {
                                            conversationHistory[conversationHistory.length - 1].content += data.choices[0].delta.content;
                                            const lastMessageElement = chatHistory.lastElementChild;
                                            lastMessageElement.textContent += data.choices[0].delta.content;
                                            window.requestAnimationFrame(() => {
                                                chatHistory.scrollTop = chatHistory.scrollHeight;
                                            });
                                        }
                                    }
                                }
                            } catch (error) {
                                // Ignore parsing errors for incomplete JSON
                            }

                            return readChunk();
                        });
                    }

                    return readChunk();
                })
                .catch(error => {
                    console.error('Error:', error);
                    showErrorToast(`Error: ${error.message}`);
                });
        }
    });

    function showErrorToast(message) {
        const toast = new bootstrap.Toast(document.getElementById('error-toast'));
        document.getElementById('error-toast-body').textContent = message;
        toast.show();
    }

    const setApiKeyButton = document.querySelector('.mb-3 .btn.btn-orange');
    setApiKeyButton.addEventListener('click', function (event) {
        event.preventDefault();
        fetchModels();
    });

    const clearChatButton = document.getElementById('clear-chat');

    function clearChat() {
        chatHistory.innerHTML = '';
        conversationHistory = [];
    }

    clearChatButton.addEventListener('click', function() {
        clearChat();
    });
});

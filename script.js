document.addEventListener('DOMContentLoaded', function () {
    const chatForm = document.getElementById('chat-form');
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelection = document.getElementById('model-selection');
    const temperatureInput = document.getElementById('temperature');
    const topPInput = document.getElementById('top_p');
    const maxTokensInput = document.getElementById('max_tokens');
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
        messageContent.className = 'message-content';
        
        if (!isUser) {
            messageContent.style.opacity = '0';
            messageContent.style.transform = 'translateX(-20px)';
            messageContent.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        } else {
            messageContent.textContent = text;
        }

        messageElement.appendChild(messageContent);
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        if (!isUser) {
            setTimeout(() => {
                messageContent.style.opacity = '1';
                messageContent.style.transform = 'translateX(0)';
            }, 10);
        }

        return messageContent;
    }

    function createMarkdownRenderer() {
        const renderer = new marked.Renderer();
        
        renderer.heading = function(text, level) {
            return `<h${level} class="mt-3 mb-2">${text}</h${level}>`;
        };

        renderer.listitem = function(text) {
            return `<li>${text}</li>`;
        };

        renderer.list = function(body, ordered, start) {
            const type = ordered ? 'ol' : 'ul';
            const startAttr = (ordered && start !== 1) ? ` start="${start}"` : '';
            return `<${type}${startAttr} class="mb-3">\n${body}</${type}>\n`;
        };

        renderer.blockquote = function(quote) {
            return `<blockquote class="blockquote border-start border-3 ps-3 py-2 mb-3">${quote}</blockquote>`;
        };

        renderer.code = function(code, language) {
            return `<pre><code class="language-${language || 'plaintext'} p-2 mb-3">${marked.parseInline(code)}</code></pre>`;
        };

        renderer.table = function(header, body) {
            return '<table class="table table-bordered mb-3">\n'
                + '<thead>\n'
                + header
                + '</thead>\n'
                + '<tbody>\n'
                + body
                + '</tbody>\n'
                + '</table>\n';
        };

        renderer.link = function(href, title, text) {
            return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        };

        renderer.image = function(href, title, text) {
            return `<img src="${href}" alt="${text}" title="${title || ''}" class="img-fluid mb-3">`;
        };

        renderer.codespan = function(code) {
            return `<code class="bg-light px-1 py-1">${marked.parseInline(code)}</code>`;
        };

        renderer.hr = function() {
            return '<hr class="my-3">';
        };

        function renderMarkdown(text) {
            return marked.parse(text, { 
                renderer: renderer,
                gfm: true,
                breaks: true,
                sanitize: false,
                smartLists: true,
                smartypants: false,
                xhtml: false
            });
        }

        return { renderMarkdown };
    }

    const markdownRenderer = createMarkdownRenderer();

    let accumulatedContent = '';
    let visibleContent = null;
    let bufferElement = null;
    let lastBuffer = '';

    function updateContent(newContent, messageContent) {
        if (!visibleContent) {
            visibleContent = document.createElement('div');
            visibleContent.className = 'markdown-content';
            messageContent.appendChild(visibleContent);
        }

        // Convert newContent to string, handling objects properly
        if (typeof newContent === 'object' && newContent !== null) {
            newContent = JSON.stringify(newContent, null, 2);
        } else if (typeof newContent !== 'string') {
            newContent = String(newContent);
        }
        
        accumulatedContent += newContent;

        // Render Markdown
        const renderedContent = markdownRenderer.renderMarkdown(accumulatedContent);

        // Update the content
        visibleContent.innerHTML = renderedContent;

        // Animate new content
        const newElements = Array.from(visibleContent.children);
        newElements.forEach(el => {
            if (!el.dataset.animated) {
                el.style.opacity = '0';
                el.style.transform = 'translateX(-10px)';
                el.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateX(0)';
                    el.dataset.animated = 'true';
                }, 10);
            }
        });

        chatHistory.scrollTop = chatHistory.scrollHeight;
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

            let assistantMessageContent = appendMessage('', false);
            accumulatedContent = '';
            visibleContent = null;

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
                const decoder = new TextDecoder("utf-8");

                function readStream() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            return;
                        }

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');
                        
                        lines.forEach(line => {
                            if (line.startsWith('data: ')) {
                                const jsonString = line.slice(5).trim(); // Remove 'data: ' prefix
                                if (jsonString === '[DONE]') {
                                    // Stream finished
                                    return;
                                }
                                try {
                                    const data = JSON.parse(jsonString);
                                    processChunk(data, assistantMessageContent);
                                } catch (error) {
                                    console.error('Error parsing JSON:', error);
                                }
                            }
                        });

                        return readStream();
                    });
                }

                return readStream();
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

    function processChunk(data, messageContent) {
        const { choices } = data;
        if (choices && choices.length > 0) {
            const { delta } = choices[0];
            if (delta && delta.content) {
                updateContent(delta.content, messageContent);
            }
        }
    }
});

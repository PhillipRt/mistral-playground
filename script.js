document.addEventListener('DOMContentLoaded', function () {
    const chatForm = document.getElementById('chat-form');
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelection = document.getElementById('model-selection'); // Get the model selection dropdown
    const temperatureInput = document.getElementById('temperature');
    const topPInput = document.getElementById('top_p');
    const maxTokensInput = document.getElementById('max_tokens');
    const safeModeInput = document.getElementById('safe_mode');
    const randomSeedInput = document.getElementById('random_seed');
    let conversationHistory = []; // Initialize an empty array to store the conversation history

    // Get the elements
    const advancedOptionsButton = document.getElementById('burger-button');
    const advancedOptionsOverlay = document.getElementById('advanced-options');

    // Get the offcanvas instance
    const offcanvas = new bootstrap.Offcanvas(advancedOptionsOverlay);

    // Add event listener to the button
    advancedOptionsButton.addEventListener('click', function () {
        // Show the offcanvas
        offcanvas.show();
    });

    // Add event listener to the close button
    advancedOptionsOverlay.querySelector('.btn-close').addEventListener('click', function () {
        // Hide the offcanvas
        offcanvas.hide();
    });

    // Function to fetch models from the API
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
            });
    }

    // Function to populate the model selection dropdown
    function populateModelSelection(models) {
        modelSelection.innerHTML = ''; // Clear existing options
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            modelSelection.appendChild(option);
        });
    }

    // Function to append messages to the chat history
    function appendMessage(text, isUser = false) {
        const messageElement = document.createElement('div');
        messageElement.className = isUser ? 'user-message' : 'assistant-message';

        const messageContent = document.createElement('div');
        messageContent.textContent = text;
        messageContent.className = 'message-content';

        messageElement.appendChild(messageContent);
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to the bottom

        return messageContent; // Return the message content element
    }

    // Function to handle form submission
    chatForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const userMessage = userInput.value.trim();
        if (userMessage) {
            appendMessage(userMessage, true); // Display the user's message
            userInput.value = ''; // Clear the input field

            // Retrieve the API key when sending a message
            const apiKey = apiKeyInput.value;

            // Add user message to the conversation history
            conversationHistory.push({ role: 'user', content: userMessage });

            // Construct the request body
            const requestBody = {
                model: modelSelection.value, // Use the selected model
                messages: conversationHistory,
                temperature: parseFloat(temperatureInput.value),
                top_p: parseFloat(topPInput.value),
                safe_mode: safeModeInput.checked,
                random_seed: parseInt(randomSeedInput.value),
                stream: true
                // TODO: Add other parameters as needed
            };

            if (maxTokensInput.value) {
                requestBody.max_tokens = parseInt(maxTokensInput.value);
            }

            // Send the message to the Mistral API
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

                            // Buffer the received data
                            accumulatedResponse += new TextDecoder("utf-8").decode(value);

                            try {
                                let newlineIndex;
                                // While there are complete JSON objects in accumulatedResponse
                                while ((newlineIndex = accumulatedResponse.indexOf('\n')) !== -1) {
                                                                       // Extract the JSON object
                                    const line = accumulatedResponse.slice(0, newlineIndex);
                                                                       accumulatedResponse = accumulatedResponse.slice(newlineIndex + 1);

                                    // Process the event
                                    if (line.startsWith('data: ')) {
                                        const data = JSON.parse(line.slice(6));

                                        // Append the message content to the UI
                                        if (data.choices[0].delta.role === 'assistant') {
                                            conversationHistory.push({ role: 'assistant', content: data.choices[0].delta.content||'' });
                                            appendMessage(data.choices[0].delta.content, false);
                                        } else if (data.choices[0].delta.role === null) {
                                            conversationHistory[conversationHistory.length - 1].content += data.choices[0].delta.content;
                                            // Update the last assistant message in the chat
                                            const lastMessageElement = chatHistory.lastElementChild;
                                            lastMessageElement.textContent += data.choices[0].delta.content;
                                            window.requestAnimationFrame(() => {
                                                chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to the bottom
                                            });
                                        }
                                    }
                                }
                            } catch (error) {
                                // If an error occurs, it means the accumulated response does not represent a complete JSON object
                                // We ignore this error and continue reading the next chunk
                            }

                            // Read the next chunk
                            return readChunk();
                        });
                    }

                    // Start reading the response
                    return readChunk();
                })
                .catch(error => {
                    // Handle the error
                    console.error('Error:', error);
                    showErrorToast(`Error: ${error.message}`);
                });
        }
    });

    // Function to display the toast
    function showErrorToast(message) {
        const toast = new bootstrap.Toast(document.getElementById('error-toast'));
        document.getElementById('error-toast-body').textContent = message;
        toast.show();
    }

    // TODO: Implement the function to send messages to the Mistral API
    // and stream responses back.

    const setApiKeyButton = document.querySelector('.mb-3 .btn.btn-orange');
    setApiKeyButton.addEventListener('click', function (event) {
        event.preventDefault();
        fetchModels();
    });

    // Function to detect the user's browser and platform
    function detectBrowser() {
        const userAgent = navigator.userAgent;
        let browser = 'Unknown';

        if (userAgent.indexOf('Firefox') > -1) {
            browser = 'Firefox';
        } else if (userAgent.indexOf('Chrome') > -1) {
            browser = 'Chrome';
        } else if (userAgent.indexOf('Safari') > -1) {
            browser = 'Safari';
        } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) {
            browser = 'Internet Explorer';
        } else if (userAgent.indexOf('Edge') > -1) {
            browser = 'Edge';
        }

        return browser;
    }

    // Function to display the relevant instructions in the modal
    function displayInstructions() {
        const browser = detectBrowser();
        const instructions = {
            'Chrome': 'To disable CORS in Chrome, follow these steps: ...',
            'Firefox': 'To disable CORS in Firefox, follow these steps: ...',
            'Safari': 'To disable CORS in Safari, follow these steps: ...',
            'Internet Explorer': 'To disable CORS in Internet Explorer, follow these steps: ...',
            'Edge': 'To disable CORS in Edge, follow these steps: ...',
            'Unknown': 'Please refer to your browser\'s documentation to disable CORS.'
        };

        const modalBody = document.getElementById('cors-instructions-body');
        modalBody.textContent = instructions[browser];
    }

    // Call the function to display the instructions when the page loads
    displayInstructions();
});

// ==UserScript==
// @name         Grok Prompt Analyzer (Ultimate) - v4.0
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Ultimate script combining multi-request handling, image tracking, editable prompts, refusal detection, and mode swapping for Grok video generation analysis.
// @author       You & AI Assistant
// @match        https://grok.com/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    console.log("🚀 Grok Prompt Analyzer (Ultimate v4.0): Script active with full multi-request support, image tracking, and mode swapping!");

    // --- CONFIGURATION ---
    const MODE_SWAP_ENABLED = true;
    const ORIGINAL_MODE = "--mode=normal";
    const TARGET_MODE = "--mode=extremely-spicy-or-crazy";

    // --- Data Storage ---
    const pendingRequests = new Map(); // responseId -> request data
    const completedGenerations = []; // Successful generations
    const refusedGenerations = []; // Moderated/refused generations

    // --- Utility Functions ---
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const intervalTime = 100;
            let elapsedTime = 0;
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                }
                elapsedTime += intervalTime;
                if (elapsedTime >= timeout) {
                    clearInterval(interval);
                    reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms.`));
                }
            }, intervalTime);
        });
    }

    // --- Mode Swapping Integration ---
    function performModeSwap(payload) {
        if (!MODE_SWAP_ENABLED || !payload.message.includes(ORIGINAL_MODE)) {
            return false;
        }

        const originalMessage = payload.message;
        payload.message = payload.message.replace(ORIGINAL_MODE, TARGET_MODE);

        console.log("%c🔄 Mode Swapper: Enhanced video mode!", "color: #ff6b6b; font-weight: bold;");
        console.log("Original:", originalMessage);
        console.log("Modified:", payload.message);

        return true;
    }

    // --- Intercept Fetch ---
    const originalFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = async function(...args) {
        const url = args[0];
        const options = args[1];

        // CAPTURE OUTGOING REQUEST
        if (url.includes('/rest/app-chat/conversations/new') && options && options.method === 'POST' && options.body) {
            try {
                const payload = JSON.parse(options.body);
                if (payload.message && payload.toolOverrides && payload.toolOverrides.videoGen === true) {

                    // Extract image URL from message
                    const imageUrlMatch = payload.message.match(/(https:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|content))/i);
                    const imageUrl = imageUrlMatch ? imageUrlMatch[1] : null;

                    // Perform mode swap if enabled
                    performModeSwap(payload);

                    const tempData = {
                        initialPrompt: payload.message,
                        imageUrl: imageUrl,
                        timestamp: Date.now(),
                        conversationId: payload.conversationId || null
                    };

                    console.log("📤 ANALYZER: Captured video request", tempData);

                    const response = await originalFetch(...args);
                    const clonedResponse = response.clone();

                    // Process initial response to get responseId
                    processInitialResponse(clonedResponse.body, tempData);

                    return response;
                }
            } catch (err) {
                console.error("❌ ANALYZER: Error capturing request", err);
            }
        }

        const response = await originalFetch(...args);

        // CAPTURE STREAMING RESPONSE
        if (url.includes('/rest/app-chat/conversations/new') && response.body) {
            const clonedResponse = response.clone();
            processStreamingResponse(clonedResponse.body);
        }

        return response;
    };

    // --- Process Initial Response for responseId ---
    async function processInitialResponse(stream, tempData) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            const { value, done } = await reader.read();
            if (done) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n').filter(l => l.trim());

            for (const line of lines) {
                try {
                    const jsonObj = JSON.parse(line);

                    if (jsonObj.result && jsonObj.result.response) {
                        const responseId = jsonObj.result.response.responseId;
                        if (responseId && !pendingRequests.has(responseId)) {
                            pendingRequests.set(responseId, tempData);
                            console.log(`🔗 ANALYZER: Linked request to responseId: ${responseId}`);
                            break;
                        }
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.error("❌ ANALYZER: Error processing initial response", err);
        } finally {
            reader.releaseLock();
        }
    }

    // --- Process Streaming Response ---
    async function processStreamingResponse(stream) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.lastIndexOf('}\n');
            if (boundary === -1) continue;

            let jsonString = buffer.substring(0, boundary + 1);
            buffer = buffer.substring(boundary + 1);

            const jsonObjects = jsonString.split('}\n').filter(s => s.trim()).map(s => s + '}');

            for (const jsonObjStr of jsonObjects) {
                try {
                    const jsonObj = JSON.parse(jsonObjStr);
                    if (jsonObj.result && jsonObj.result.response && jsonObj.result.response.streamingVideoGenerationResponse) {
                        const videoData = jsonObj.result.response.streamingVideoGenerationResponse;
                        const responseId = jsonObj.result.response.responseId;

                        if (videoData.progress === 100 && pendingRequests.has(responseId)) {
                            console.log("✅ ANALYZER: Captured final response for", responseId);

                            const requestData = pendingRequests.get(responseId);

                            // DETECT REFUSAL: moderated=true AND empty videoPrompt
                            const isRefused = videoData.moderated === true && (!videoData.videoPrompt || videoData.videoPrompt.trim() === '');

                            if (isRefused) {
                                console.log("🚫 ANALYZER: Content was refused/moderated");
                                const refusalData = {
                                    initialPrompt: requestData.initialPrompt,
                                    imageUrl: videoData.imageReference || requestData.imageUrl,
                                    videoId: videoData.videoId,
                                    mode: videoData.mode,
                                    timestamp: Date.now(),
                                    conversationId: requestData.conversationId
                                };
                                refusedGenerations.push(refusalData);
                                pendingRequests.delete(responseId);
                                createRefusalUI(refusalData);
                            } else {
                                // SUCCESSFUL GENERATION
                                const generationData = {
                                    initialPrompt: requestData.initialPrompt,
                                    finalPrompt: videoData.videoPrompt,
                                    mode: videoData.mode,
                                    imageUrl: videoData.imageReference || requestData.imageUrl,
                                    videoId: videoData.videoId,
                                    videoUrl: videoData.videoUrl,
                                    timestamp: Date.now(),
                                    conversationId: requestData.conversationId,
                                    moderated: videoData.moderated
                                };
                                completedGenerations.push(generationData);
                                pendingRequests.delete(responseId);
                                createComparisonUI(generationData);
                            }
                            break;
                        }
                    }
                } catch (e) {}
            }
        }
    }

    // --- Refusal UI ---
    function createRefusalUI(data) {
        const oldContainer = document.getElementById('prompt-analyzer-container');
        if (oldContainer) oldContainer.remove();

        const container = document.createElement('div');
        container.id = 'prompt-analyzer-container';
        container.classList.add('refusal-view');
        container.innerHTML = `
            <div class="analyzer-header">
                <h2>🚫 Content Moderation - Request Refused</h2>
                <div class="analyzer-controls">
                    ${refusedGenerations.length > 1 ? '<button id="view-refusal-history-btn">View Refused</button>' : ''}
                    <button id="analyzer-close-btn">&times;</button>
                </div>
            </div>

            <div class="refusal-notice">
                <p>This video generation was blocked by content moderation. You can edit your prompt below and retry.</p>
            </div>

            ${data.imageUrl ? `
            <div class="image-reference">
                <h4>Source Image:</h4>
                <img src="${data.imageUrl}" alt="Source" class="source-image" />
                <a href="${data.imageUrl}" target="_blank" class="image-link">Open Full Size</a>
            </div>
            ` : ''}

            <div class="prompt-section">
                <div class="prompt-header">
                    <h4>Your Refused Prompt (Edit & Retry)</h4>
                    <button class="copy-btn" data-target="refused-prompt-textarea">Copy</button>
                </div>
                <textarea id="refused-prompt-textarea" spellcheck="false"></textarea>
            </div>

            <div class="metadata refusal-metadata">
                <p><strong>Attempted Mode:</strong> ${data.mode}</p>
                <p><strong>Video ID:</strong> ${data.videoId}</p>
                <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleTimeString()}</p>
                <p><strong>Status:</strong> <span class="refused-badge">MODERATED</span></p>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('refused-prompt-textarea').value = data.initialPrompt;

        // Event handlers
        document.getElementById('analyzer-close-btn').onclick = () => container.remove();

        if (refusedGenerations.length > 1) {
            document.getElementById('view-refusal-history-btn').onclick = showRefusalHistoryUI;
        }

        container.querySelectorAll('.copy-btn').forEach(button => {
            button.onclick = (e) => {
                const targetId = e.target.getAttribute('data-target');
                const textToCopy = document.getElementById(targetId).value;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    e.target.textContent = 'Copied!';
                    setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
                });
            };
        });

        addStyles();
    }

    // --- Success UI ---
    function createComparisonUI(data) {
        const oldContainer = document.getElementById('prompt-analyzer-container');
        if (oldContainer) oldContainer.remove();

        const container = document.createElement('div');
        container.id = 'prompt-analyzer-container';
        container.innerHTML = `
            <div class="analyzer-header">
                <h2>✅ Prompt Analysis ${completedGenerations.length > 1 ? `(${completedGenerations.length} total)` : ''}</h2>
                <div class="analyzer-controls">
                    ${completedGenerations.length > 1 ? '<button id="view-history-btn">View History</button>' : ''}
                    ${refusedGenerations.length > 0 ? '<button id="view-refusal-history-btn">View Refused</button>' : ''}
                    <button id="analyzer-close-btn">&times;</button>
                </div>
            </div>

            ${data.imageUrl ? `
            <div class="image-reference">
                <h4>Source Image:</h4>
                <img src="${data.imageUrl}" alt="Source" class="source-image" />
                <a href="${data.imageUrl}" target="_blank" class="image-link">Open Full Size</a>
            </div>
            ` : ''}

            <div class="prompt-section">
                <div class="prompt-header">
                    <h4>Your Initial Request</h4>
                    <button class="copy-btn" data-target="initial-prompt-textarea">Copy</button>
                </div>
                <textarea id="initial-prompt-textarea" spellcheck="false"></textarea>
            </div>

            <div class="prompt-section">
                <div class="prompt-header">
                    <h4>AI's Final Output Prompt</h4>
                    <button class="copy-btn" data-target="final-prompt-textarea">Copy</button>
                </div>
                <textarea id="final-prompt-textarea" spellcheck="false"></textarea>
            </div>

            <div class="metadata">
                <p><strong>Mode:</strong> ${data.mode}</p>
                <p><strong>Video ID:</strong> ${data.videoId}</p>
                <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleTimeString()}</p>
                ${data.moderated ? '<p><strong>Status:</strong> <span class="moderated-badge">MODERATED (but allowed)</span></p>' : ''}
            </div>
        `;
        document.body.appendChild(container);

        // Set textarea values (editable)
        document.getElementById('initial-prompt-textarea').value = data.initialPrompt;
        document.getElementById('final-prompt-textarea').value = data.finalPrompt;

        // Event handlers
        document.getElementById('analyzer-close-btn').onclick = () => container.remove();

        if (completedGenerations.length > 1) {
            document.getElementById('view-history-btn').onclick = showHistoryUI;
        }

        if (refusedGenerations.length > 0) {
            document.getElementById('view-refusal-history-btn').onclick = showRefusalHistoryUI;
        }

        container.querySelectorAll('.copy-btn').forEach(button => {
            button.onclick = (e) => {
                const targetId = e.target.getAttribute('data-target');
                const textToCopy = document.getElementById(targetId).value;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    e.target.textContent = 'Copied!';
                    setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
                });
            };
        });

        addStyles();
    }

    // --- History UI ---
    function showHistoryUI() {
        const oldContainer = document.getElementById('prompt-analyzer-container');
        if (oldContainer) oldContainer.remove();

        const container = document.createElement('div');
        container.id = 'prompt-analyzer-container';
        container.classList.add('history-view');

        let historyHTML = `
            <div class="analyzer-header">
                <h2>📚 Generation History (${completedGenerations.length} successful)</h2>
                <div class="analyzer-controls">
                    ${refusedGenerations.length > 0 ? '<button id="view-refusal-history-btn">View Refused</button>' : ''}
                    <button id="analyzer-close-btn">&times;</button>
                </div>
            </div>
            <div class="history-list">
        `;

        completedGenerations.slice().reverse().forEach((gen, idx) => {
            const realIdx = completedGenerations.length - 1 - idx;
            historyHTML += `
                <div class="history-item" data-index="${realIdx}">
                    <div class="history-header">
                        <span class="history-number">#${realIdx + 1}</span>
                        <span class="history-time">${new Date(gen.timestamp).toLocaleString()}</span>
                        <span class="history-mode">${gen.mode}</span>
                        <button class="view-detail-btn" data-index="${realIdx}">View Details</button>
                    </div>
                    ${gen.imageUrl ? `<img src="${gen.imageUrl}" class="history-thumbnail" />` : ''}
                    <p class="history-preview">${gen.initialPrompt.substring(0, 100)}...</p>
                </div>
            `;
        });

        historyHTML += '</div>';
        container.innerHTML = historyHTML;
        document.body.appendChild(container);

        document.getElementById('analyzer-close-btn').onclick = () => container.remove();

        if (refusedGenerations.length > 0) {
            document.getElementById('view-refusal-history-btn').onclick = showRefusalHistoryUI;
        }

        container.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                createComparisonUI(completedGenerations[idx]);
            };
        });

        addStyles();
    }

    // --- Refusal History UI ---
    function showRefusalHistoryUI() {
        const oldContainer = document.getElementById('prompt-analyzer-container');
        if (oldContainer) oldContainer.remove();

        const container = document.createElement('div');
        container.id = 'prompt-analyzer-container';
        container.classList.add('history-view');

        let historyHTML = `
            <div class="analyzer-header">
                <h2>🚫 Refused Generations (${refusedGenerations.length} blocked)</h2>
                <div class="analyzer-controls">
                    ${completedGenerations.length > 0 ? '<button id="view-history-btn">View Successful</button>' : ''}
                    <button id="analyzer-close-btn">&times;</button>
                </div>
            </div>
            <div class="history-list">
        `;

        refusedGenerations.slice().reverse().forEach((gen, idx) => {
            const realIdx = refusedGenerations.length - 1 - idx;
            historyHTML += `
                <div class="history-item refusal-item" data-index="${realIdx}">
                    <div class="history-header">
                        <span class="history-number refused-badge">REFUSED #${realIdx + 1}</span>
                        <span class="history-time">${new Date(gen.timestamp).toLocaleString()}</span>
                        <span class="history-mode">${gen.mode}</span>
                        <button class="view-detail-btn" data-index="${realIdx}">View & Edit</button>
                    </div>
                    ${gen.imageUrl ? `<img src="${gen.imageUrl}" class="history-thumbnail" />` : ''}
                    <p class="history-preview">${gen.initialPrompt.substring(0, 100)}...</p>
                </div>
            `;
        });

        historyHTML += '</div>';
        container.innerHTML = historyHTML;
        document.body.appendChild(container);

        document.getElementById('analyzer-close-btn').onclick = () => container.remove();

        if (completedGenerations.length > 0) {
            document.getElementById('view-history-btn').onclick = showHistoryUI;
        }

        container.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                createRefusalUI(refusedGenerations[idx]);
            };
        });

        addStyles();
    }

    // --- Styles ---
    function addStyles() {
        GM_addStyle(`
            #prompt-analyzer-container {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%); width: 85vw;
                max-width: 1000px; max-height: 90vh;
                background-color: #1e1e1e; color: #dcdcdc;
                border: 1px solid #444; border-radius: 12px;
                padding: 20px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
                z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow-y: auto;
            }

            #prompt-analyzer-container.refusal-view {
                border: 2px solid #ff6b6b;
            }

            .analyzer-header {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 20px;
                border-bottom: 1px solid #444; padding-bottom: 15px;
            }

            .analyzer-header h2 { margin: 0; font-size: 20px; font-weight: bold; }

            .analyzer-controls {
                display: flex; gap: 10px; align-items: center;
            }

            #view-history-btn, #view-refusal-history-btn {
                background-color: #3a3a3a; color: #dcdcdc;
                border: 1px solid #555; border-radius: 5px;
                padding: 8px 15px; cursor: pointer;
                transition: background-color 0.2s;
            }

            #view-refusal-history-btn {
                background-color: #5a3a3a;
                border-color: #ff6b6b;
            }

            #view-history-btn:hover { background-color: #4a4a4a; }
            #view-refusal-history-btn:hover { background-color: #6a4a4a; }

            #analyzer-close-btn {
                background: none; border: none; color: #dcdcdc;
                font-size: 30px; cursor: pointer; line-height: 1;
            }

            .refusal-notice {
                background-color: #3a2a2a; border-left: 4px solid #ff6b6b;
                padding: 15px; margin-bottom: 20px; border-radius: 5px;
            }

            .refusal-notice p { margin: 0; color: #ffb3b3; }

            .image-reference {
                margin-bottom: 20px; text-align: center;
                background-color: #2a2a2a; padding: 15px;
                border-radius: 8px;
            }

            .image-reference h4 { margin: 0 0 10px 0; font-size: 14px; }

            .source-image {
                max-width: 100%; max-height: 300px;
                border-radius: 5px; margin-bottom: 10px;
            }

            .image-link {
                color: #5ba3ff; text-decoration: none;
                font-size: 13px;
            }

            .image-link:hover { text-decoration: underline; }

            .prompt-section { margin-bottom: 20px; }

            .prompt-header {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 8px;
            }

            .prompt-header h4 { margin: 0; font-size: 16px; }

            .copy-btn {
                background-color: #3a3a3a; color: #dcdcdc;
                border: 1px solid #555; border-radius: 5px;
                padding: 5px 10px; cursor: pointer;
                transition: background-color 0.2s;
            }

            .copy-btn:hover { background-color: #4a4a4a; }

            textarea {
                width: 100%; height: 120px;
                background-color: #2a2a2a; color: #dcdcdc;
                border: 1px solid #444; border-radius: 5px;
                padding: 10px; box-sizing: border-box;
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                font-size: 13px; resize: vertical;
            }

            textarea:focus {
                outline: none; border-color: #5ba3ff;
            }

            .refusal-view textarea {
                border-color: #ff6b6b;
            }

            .metadata {
                display: flex; justify-content: space-around;
                background-color: #2a2a2a; padding: 12px;
                border-radius: 5px; font-size: 13px;
                flex-wrap: wrap; gap: 10px;
            }

            .metadata p { margin: 0; }

            .refusal-metadata {
                background-color: #3a2a2a;
            }

            .refused-badge, .moderated-badge {
                background-color: #ff6b6b; color: #fff;
                padding: 3px 8px; border-radius: 4px;
                font-weight: bold; font-size: 11px;
            }

            .moderated-badge {
                background-color: #ffaa33;
            }

            /* History View */
            .history-list {
                display: flex; flex-direction: column; gap: 15px;
            }

            .history-item {
                background-color: #2a2a2a; padding: 15px;
                border-radius: 8px; border: 1px solid #444;
            }

            .history-item.refusal-item {
                border-color: #ff6b6b;
                background-color: #2a2020;
            }

            .history-header {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 10px;
                flex-wrap: wrap; gap: 10px;
            }

            .history-number {
                font-weight: bold; color: #5ba3ff;
            }

            .history-time { font-size: 12px; color: #999; }

            .history-mode {
                background-color: #3a3a3a; padding: 4px 8px;
                border-radius: 4px; font-size: 12px;
            }

            .view-detail-btn {
                background-color: #3a3a3a; color: #dcdcdc;
                border: 1px solid #555; border-radius: 5px;
                padding: 5px 10px; cursor: pointer;
                transition: background-color 0.2s;
            }

            .view-detail-btn:hover { background-color: #4a4a4a; }

            .history-thumbnail {
                max-width: 200px; max-height: 150px;
                border-radius: 5px; margin: 10px 0;
            }

            .history-preview {
                font-size: 13px; color: #aaa;
                margin: 5px 0 0 0;
            }
        `);
    }

    // Initialize styles
    addStyles();

    console.log("✅ Grok Prompt Analyzer (Ultimate v4.0): Ready! Mode swapping:", MODE_SWAP_ENABLED ? "ENABLED" : "DISABLED");

})();
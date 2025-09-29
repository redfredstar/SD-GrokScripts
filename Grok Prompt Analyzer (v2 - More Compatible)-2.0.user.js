// ==UserScript==
// @name         Grok Prompt Analyzer (v2 - More Compatible)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Captures your initial video prompt and the AI's final generated prompt, displaying them side-by-side in a UI for easy comparison and copying. Uses a more compatible styling method.
// @author       You & AI
// @match        https://grok.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    console.log("Grok Prompt Analyzer (v2): Script active.");

    // --- State Variables ---
    let initialPrompt = null;
    let isMonitoringForResponse = false;

    // --- Intercept the Fetch Request ---
    const originalFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = async function(...args) {
        const url = args[0];
        const options = args[1];

        // 1. CAPTURE THE INITIAL REQUEST
        if (url.includes('/rest/app-chat/conversations/new') && options && options.method === 'POST' && options.body) {
            try {
                const payload = JSON.parse(options.body);
                if (payload.message && payload.toolOverrides && payload.toolOverrides.videoGen === true) {
                    initialPrompt = payload.message;
                    isMonitoringForResponse = true;
                    console.log("ANALYZER: Captured initial request. Waiting for final response...");
                    console.log("Initial Prompt:", initialPrompt);
                }
            } catch (err) {}
        }

        const response = await originalFetch(...args);

        // 2. CAPTURE THE FINAL RESPONSE
        if (isMonitoringForResponse && url.includes('/rest/app-chat/conversations/new') && response.body) {
            const clonedResponse = response.clone();
            processResponseStream(clonedResponse.body);
        }

        return response;
    };

    // --- Process the Streaming Response Data ---
    async function processResponseStream(stream) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let foundFinalPacket = false;

        while (true) {
            const { value, done } = await reader.read();
            if (done || foundFinalPacket) break;

            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.lastIndexOf('}\n');
            if (boundary === -1) continue;

            let jsonString = buffer.substring(0, boundary + 1);
            buffer = buffer.substring(boundary + 1);

            const jsonObjects = jsonString.split('}\n').filter(s => s.trim() !== '').map(s => s + '}');

            for (const jsonObjStr of jsonObjects) {
                try {
                    const jsonObj = JSON.parse(jsonObjStr);
                    if (jsonObj.result && jsonObj.result.response && jsonObj.result.response.streamingVideoGenerationResponse) {
                        const videoData = jsonObj.result.response.streamingVideoGenerationResponse;

                        if (videoData.progress === 100) {
                            console.log("ANALYZER: Captured final response!");
                            const finalPrompt = videoData.videoPrompt;
                            const finalMode = videoData.mode;
                            createComparisonUI(initialPrompt, finalPrompt, finalMode);

                            isMonitoringForResponse = false;
                            initialPrompt = null;
                            foundFinalPacket = true; // Set flag to exit loop
                            break; // Exit inner for-loop
                        }
                    }
                } catch (e) {}
            }
        }
    }


    // --- UI Creation Function ---
    function createComparisonUI(initial, final, mode) {
        const oldContainer = document.getElementById('prompt-analyzer-container');
        if (oldContainer) oldContainer.remove();

        const container = document.createElement('div');
        container.id = 'prompt-analyzer-container';
        container.innerHTML = `
            <div class="analyzer-header">
                <h2>Prompt Analysis</h2>
                <button id="analyzer-close-btn">&times;</button>
            </div>
            <div class="prompt-section">
                <div class="prompt-header">
                    <h4>Your Initial Request</h4>
                    <button class="copy-btn" data-target="initial-prompt-textarea">Copy</button>
                </div>
                <textarea id="initial-prompt-textarea" readonly></textarea>
            </div>
            <div class="prompt-section">
                <div class="prompt-header">
                    <h4>AI's Final Output Prompt</h4>
                    <button class="copy-btn" data-target="final-prompt-textarea">Copy</button>
                </div>
                <textarea id="final-prompt-textarea" readonly></textarea>
            </div>
            <p class="final-mode"><strong>Final Mode Used:</strong> ${mode}</p>
        `;
        document.body.appendChild(container);

        document.getElementById('initial-prompt-textarea').value = initial;
        document.getElementById('final-prompt-textarea').value = final;

        document.getElementById('analyzer-close-btn').onclick = () => container.remove();
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
    }

    // --- Manual Style Injection (More Compatible) ---
    function addGlobalStyle(css) {
        const head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        const style = document.createElement('style');
        style.textContent = css;
        head.appendChild(style);
    }

    addGlobalStyle(`
        #prompt-analyzer-container {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%); width: 80vw;
            max-width: 900px; background-color: #1e1e1e;
            color: #dcdcdc; border: 1px solid #444;
            border-radius: 12px; padding: 20px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
            z-index: 99999; font-family: sans-serif;
        }
        .analyzer-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 15px;
        }
        .analyzer-header h2 { margin: 0; font-size: 20px; }
        #analyzer-close-btn {
            background: none; border: none; color: #dcdcdc;
            font-size: 30px; cursor: pointer; line-height: 1;
        }
        .prompt-section { margin-bottom: 20px; }
        .prompt-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 8px;
        }
        .prompt-header h4 { margin: 0; font-size: 16px; }
        .copy-btn {
            background-color: #3a3a3a; color: #dcdcdc; border: 1px solid #555;
            border-radius: 5px; padding: 5px 10px; cursor: pointer;
            transition: background-color 0.2s;
        }
        .copy-btn:hover { background-color: #4a4a4a; }
        textarea {
            width: 100%; height: 120px; background-color: #2a2a2a;
            color: #dcdcdc; border: 1px solid #444; border-radius: 5px;
            padding: 10px; box-sizing: border-box; font-family: monospace;
            font-size: 13px; resize: vertical;
        }
        .final-mode {
            text-align: center; font-size: 14px; background-color: #2a2a2a;
            padding: 8px; border-radius: 5px;
        }
    `);

    // I also improved the stream processing logic slightly for more reliability.

})();
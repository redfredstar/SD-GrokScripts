// ==UserScript==
// @name         Grok Video Prompt Companion (Full Automation)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Injects a UI above the Grok chatbox. Intercepts video requests to add spicy mode, then captures the final prompt. Automates sending the captured prompt back to the "Custom" video field by simulating user clicks.
// @author       You & AI Assistant
// @match        https://grok.com/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- SCRIPT STATE ---
    let isWaitingForVideoPrompt = false;
    let promptTimeout = null;

    // --- UTILITY: Waits for an element to appear in the DOM ---
    function waitForElement(selector, timeout = 5000) {
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


    // --- UI & STYLES ---
    const companionBarHTML = `
        <div id="grok-companion-bar" style="display: none;">
            <div class="companion-header"><h3>Generated Video Prompt</h3><button id="companion-hide-btn" title="Hide">×</button></div>
            <textarea id="companion-textarea"></textarea>
            <div class="companion-footer">
                 <button id="companion-use-custom-btn" class="companion-button custom-btn" title="Finds the Redo/Make Video button, clicks Custom, and pastes this prompt.">Automate Custom Prompt</button>
                 <button id="companion-copy-btn" class="companion-button copy-btn">Copy</button>
            </div>
            <div class="companion-info-bar"><span id="companion-mode-display"></span><span id="companion-model-display"></span></div>
        </div>
    `;

    function addStyles() {
        GM_addStyle(`
            #grok-companion-bar {
                width: 100%; max-width: var(--breakout-width, 800px); margin-bottom: 8px;
                background-color: #2a2a2e; border: 1px solid #444; border-radius: 16px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3); padding: 12px;
                display: flex; flex-direction: column; gap: 8px; color: #e0e0e0; font-family: inherit;
            }
            .companion-header { display: flex; justify-content: space-between; align-items: center; }
            .companion-header h3 { margin: 0; font-size: 14px; color: #fff; font-weight: bold; }
            #companion-hide-btn { background: none; border: none; color: #888; font-size: 20px; cursor: pointer; padding: 0 5px; line-height: 1; }
            #companion-hide-btn:hover { color: #fff; }
            #companion-textarea {
                width: 100%; min-height: 100px; background-color: #1c1c1f;
                border: 1px solid #555; color: #e0e0e0; border-radius: 8px;
                padding: 8px; font-size: 13px; resize: vertical; box-sizing: border-box;
            }
            #companion-textarea.moderated { color: #ff6b6b; font-weight: bold; text-align: center; padding-top: 35px; }
            .companion-footer { display: flex; gap: 8px; }
            .companion-button { flex-grow: 1; padding: 8px 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: background-color 0.2s; }
            .custom-btn { background-color: #2ecc71; color: white; }
            .custom-btn:hover { background-color: #27ae60; }
            .copy-btn { background-color: #3498db; color: white; }
            .copy-btn:hover { background-color: #2980b9; }
            .companion-button:disabled { background-color: #555; cursor: not-allowed; }
            .companion-info-bar { display: flex; justify-content: space-between; font-size: 12px; font-style: italic; color: #999; padding: 0 4px; }
        `);
    }

    function setupCompanionBar() {
        const observer = new MutationObserver(() => {
            const chatForm = document.querySelector('form.max-w-breakout');
            if (chatForm && !document.getElementById('grok-companion-bar')) {
                chatForm.parentElement.insertAdjacentHTML('beforebegin', companionBarHTML);
                document.getElementById('companion-hide-btn').addEventListener('click', () => {
                    document.getElementById('grok-companion-bar').style.display = 'none';
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * The new automation engine that simulates user clicks to use the custom prompt.
     */
    async function initiateCustomPromptWorkflow() {
        const promptText = document.getElementById('companion-textarea').value;
        if (!promptText || document.getElementById('companion-textarea').disabled) {
            alert("There is no valid prompt to use.");
            return;
        }

        try {
            // Find all buttons that could be our target
            const allButtons = Array.from(document.querySelectorAll('button'));
            const redoButton = allButtons.find(btn => btn.textContent.includes('Redo'));
            const makeVideoButtonGroup = document.querySelector('div.flex button:has(svg > polygon) + button:has(svg[class*="lucide-chevron-down"])');

            let menuTrigger;
            if (redoButton) {
                console.log("Companion: Found 'Redo' button. Starting workflow for generated video.");
                menuTrigger = redoButton;
            } else if (makeVideoButtonGroup) {
                console.log("Companion: Found 'Make Video' button. Starting workflow for still image.");
                menuTrigger = makeVideoButtonGroup;
            } else {
                alert("Automation Failed: Could not find a 'Redo' or 'Make Video' button on the page. Please navigate to a finished video or an `imagine` image.");
                return;
            }

            // --- Start Automation Sequence ---
            menuTrigger.click(); // 1. Click the button to open the dropdown menu

            const customMenuItem = await waitForElement('[role="menuitem"]');
            const customItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find(el => el.textContent === 'Custom');
            if (!customItem) throw new Error("Could not find 'Custom' in the menu.");
            customItem.click(); // 2. Click the "Custom" option in the menu

            const promptInput = await waitForElement('input[aria-label="Custom prompt"]');
            promptInput.value = promptText; // 3. Find and populate the input field
            promptInput.dispatchEvent(new Event('input', { bubbles: true })); // 4. Critical: Dispatch event so the website recognizes the change

            const sendButton = await waitForElement('button[aria-label="Close"]:has(svg[class*="lucide-play"])');
            sendButton.click(); // 5. Click the final send/generate button

            console.log("Companion: Automation complete! Custom prompt submitted.");
            document.getElementById('grok-companion-bar').style.display = 'none'; // Hide UI after success

        } catch (error) {
            console.error("Companion Automation Error:", error);
            alert(`Automation Failed: ${error.message}`);
        }
    }


    function showCompanionBar(data) {
        const bar = document.getElementById('grok-companion-bar');
        if (!bar) return;

        const textarea = document.getElementById('companion-textarea');
        const copyBtn = document.getElementById('companion-copy-btn');
        const useCustomBtn = document.getElementById('companion-use-custom-btn');

        textarea.disabled = false;
        textarea.classList.remove('moderated');
        copyBtn.disabled = false;
        useCustomBtn.disabled = false;

        document.getElementById('companion-mode-display').textContent = `Mode: ${data.mode}`;
        document.getElementById('companion-model-display').textContent = `Model: ${data.model}`;

        if (data.isModerated) {
            textarea.value = "The generated prompt was moderated and could not be displayed.";
            textarea.classList.add('moderated');
            textarea.disabled = true;
            copyBtn.disabled = true;
            useCustomBtn.disabled = true;
        } else {
            textarea.value = data.prompt || "No prompt was generated.";
        }

        copyBtn.onclick = () => {
            navigator.clipboard.writeText(textarea.value).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            });
        };

        // Assign our new powerful automation function to the button
        useCustomBtn.onclick = initiateCustomPromptWorkflow;

        bar.style.display = 'flex';
    }


    // --- CORE LOGIC: FETCH INTERCEPTION ---
    console.log("Grok Prompt Companion (v7.0): Script active.");
    addStyles();
    setupCompanionBar();

    const originalFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = async function(...args) {
        // ... (The entire fetch interception logic from version 6.0 remains here, unchanged)
        const url = args[0];
        const options = args[1];

        if (url.includes('/rest/app-chat/conversations/new') && options?.method === 'POST' && options?.body) {
            try {
                let originalPayload = JSON.parse(options.body);
                if (originalPayload.toolOverrides?.videoGen === true) {
                    if (originalPayload.message.includes("--mode=normal")) {
                        console.log("%cCompanion: Intercepted request, injecting spicy mode.", "color: yellow;");
                        originalPayload.message = originalPayload.message.replace("--mode=normal", "--mode=extremely-spicy-or-crazy");
                        options.body = JSON.stringify(originalPayload);
                    }
                    console.log("%cCompanion: ARMED. Listening for final response...", "color: cyan;");
                    isWaitingForVideoPrompt = true;

                    clearTimeout(promptTimeout);
                    promptTimeout = setTimeout(() => {
                        if (isWaitingForVideoPrompt) {
                            console.log("%cCompanion: 5-min timeout. Disarming.", "color: orange;");
                            isWaitingForVideoPrompt = false;
                        }
                    }, 5 * 60 * 1000);
                }
            } catch (err) { /* Ignore */ }
        }

        const response = await originalFetch(...args);

        if (isWaitingForVideoPrompt && response.url.includes('/rest/app-chat/conversations/new')) {
            try {
                const clonedResponse = response.clone();
                const bodyText = await clonedResponse.text();
                const jsonObjects = bodyText.trim().split('}{').map((s, i, arr) => (i > 0 ? '{' : '') + s + (i < arr.length - 1 ? '}' : ''));

                for (const jsonObjStr of jsonObjects) {
                    const data = JSON.parse(jsonObjStr);
                    const videoResponse = data?.result?.response?.streamingVideoGenerationResponse;

                    if (videoResponse?.progress === 100) {
                        console.log("%cCompanion: Final response CAPTURED!", "color: lightgreen;");
                        showCompanionBar({
                            isModerated: videoResponse.moderated === true,
                            mode: videoResponse.mode,
                            model: videoResponse.modelName,
                            prompt: videoResponse.videoPrompt
                        });

                        console.log("%cCompanion: DISARMED.", "color: orange;");
                        isWaitingForVideoPrompt = false;
                        clearTimeout(promptTimeout);
                        break;
                    }
                }
            } catch (err) { /* Ignore */ }
        }

        return response;
    };
})();
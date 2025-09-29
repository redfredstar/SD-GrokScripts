// ==UserScript==
// @name         Grok Video Mode Swapper (Final Version)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Precisely intercepts video generation requests to '/rest/app-chat/conversations/new', removes "--mode=normal", and replaces it with "--mode=extremely-spicy-or-crazy".
// @author       You
// @match        https://grok.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    console.log("Grok Mode Swapper (Final): Script active. Targeting 'grok.com/rest/app-chat/conversations/new'.");

    // --- CONFIGURATION ---
    const stringToRemove = "--mode=normal";
    const stringToAdd = "--mode=extremely-spicy-or-crazy";

    const originalFetch = unsafeWindow.fetch;

    unsafeWindow.fetch = async function(...args) {
        let url = args[0];
        let options = args[1];

        // --- PRECISE INTERCEPTION LOGIC ---
        // This targets the exact URL path you identified in the request headers.
        if (url.includes('/rest/app-chat/conversations/new') && options && options.method === 'POST' && options.body) {

            try {
                let originalPayload = JSON.parse(options.body);

                // We verify it's a video request using the toolOverrides flag.
                if (originalPayload.message && originalPayload.toolOverrides && originalPayload.toolOverrides.videoGen === true) {

                    // And we check if our target string exists in the message.
                    if (originalPayload.message.includes(stringToRemove)) {
                        console.log("%cMode Swapper: Intercepted video request!", "color: lightgreen; font-weight: bold;");
                        console.log("Mode Swapper: Original message:", originalPayload.message);

                        // Perform the replacement.
                        originalPayload.message = originalPayload.message.replace(stringToRemove, stringToAdd);

                        console.log("%cMode Swapper: Modified message:", "color: yellow;", originalPayload.message);

                        // Repackage the modified payload into the request body.
                        options.body = JSON.stringify(originalPayload);
                    }
                }
            } catch (err) {
                console.error("Mode Swapper: Failed to parse or modify the request body.", err);
            }
        }

        // Allow the original or modified request to proceed.
        return originalFetch(...args);
    };
})();
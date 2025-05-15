// content_script.js

// This script runs in the context of the Gmail page.
console.log("Gmail Format Copier content script loaded and active on this Gmail page.");

// Since the core logic for getting and applying styles (getSelectedStyleFromPage, applyStyleToSelectionInPage)
// is defined in background.js and injected via chrome.scripting.executeScript,
// this content script itself doesn't need to contain that logic directly.

// It primarily serves as:
// 1. A declaration in manifest.json that this extension interacts with mail.google.com.
// 2. A target context for chrome.scripting.executeScript from the background script.

// The functions `getSelectedStyleFromPage` and `applyStyleToSelectionInPage`
// will be executed in this script's context when injected by the background script,
// so they will have access to the page's DOM (window, document).

// background.js
const EXTENSION_PREFIX_BG = "[RichFormat BG]";

// 1. Context Menus Setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "copyFormatContextMenu_v3",
    title: "Copy Rich Format",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "pasteFormatContextMenu_v3",
    title: "Paste Rich Format",
    contexts: ["selection", "editable"]
  });
  console.log(EXTENSION_PREFIX_BG, "Context menus created/updated.");
});

// Listener for Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) {
    console.error(EXTENSION_PREFIX_BG, "Tab ID missing for context menu click.");
    return;
  }

  const actionToPerform = info.menuItemId === "copyFormatContextMenu_v3" ? "copyRichFormatRequested" :
                         info.menuItemId === "pasteFormatContextMenu_v3" ? "pasteRichFormatRequested" : null;

  if (actionToPerform) {
    console.log(EXTENSION_PREFIX_BG, `Context menu '${info.menuItemId}'. Sending action '${actionToPerform}' to tab ${tab.id}, frame ${info.frameId || 'main'}`);
    chrome.tabs.sendMessage(tab.id, { action: actionToPerform, source: "contextMenu_v3" }, { frameId: info.frameId })
      .then(response => {
        console.log(EXTENSION_PREFIX_BG, "Response from content script (context menu):", response);
      })
      .catch(err => {
        console.warn(EXTENSION_PREFIX_BG, `Error sending context menu message to frame ${info.frameId || 'main'} (tab ${tab.id}): ${err.message}. (May be okay if script not on page/frame)`);
      });
  }
});

// 2. Keyboard Shortcuts (Commands) Listener
chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab || !tab.id) {
    console.error(EXTENSION_PREFIX_BG, "Tab ID missing for command.");
    return;
  }
  console.log(EXTENSION_PREFIX_BG, `Command '${command}' received for tab ${tab.id}.`);

  let functionToExecuteInPage;

  if (command === "trigger-copy-format") {
    functionToExecuteInPage = () => {
        console.log('[RichFormat Injected] Alt+C: Attempting window.richFormatCopier_doCopy');
        if(typeof window.richFormatCopier_doCopy === 'function') window.richFormatCopier_doCopy();
        else console.error('[RichFormat Injected] window.richFormatCopier_doCopy is NOT a function!');
    };
  } else if (command === "trigger-paste-format") {
    functionToExecuteInPage = () => {
        console.log('[RichFormat Injected] Alt+V: Attempting window.richFormatCopier_doPaste');
        if(typeof window.richFormatCopier_doPaste === 'function') window.richFormatCopier_doPaste();
        else console.error('[RichFormat Injected] window.richFormatCopier_doPaste is NOT a function!');
    };
  }

  if (functionToExecuteInPage) {
    console.log(EXTENSION_PREFIX_BG, `Executing script for command '${command}' in all frames of tab ${tab.id}.`);
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: functionToExecuteInPage
    })
    .then((injectionResults) => {
        if (chrome.runtime.lastError) {
            console.error(EXTENSION_PREFIX_BG, `Error from executeScript for ${command}: ${chrome.runtime.lastError.message}`);
        } else if (!injectionResults || injectionResults.length === 0) {
            console.warn(EXTENSION_PREFIX_BG, `Script for '${command}' executed but in zero frames. Check page validity or if content script is blocked.`);
        }
    })
    .catch(err => {
      console.error(EXTENSION_PREFIX_BG, `Promise rejection during executeScript for '${command}':`, err.message);
    });
  } else {
    console.warn(EXTENSION_PREFIX_BG, "Unknown command:", command);
  }
});
const CONTEXT_MENU_ID_COPY = "formatBrushCopy"; // Changed to avoid potential conflicts
const CONTEXT_MENU_ID_PASTE = "formatBrushPaste";

function executeCopyFormat(tab) {
  if (!tab || !tab.id) {
    console.error(chrome.i18n.getMessage("logGeneralError"), "Invalid tab object for copy operation.");
    return;
  }
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: getSelectedStyleFromPage // This function is defined below
  }).then((injectionResults) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.i18n.getMessage("logErrorInjectingScript"), "for copy:", chrome.runtime.lastError.message);
      return;
    }
    if (injectionResults && injectionResults.length > 0 && injectionResults[0].result) {
      const style = injectionResults[0].result;
      if (style) {
        chrome.storage.local.set({ copiedGmailStyle: style }, () => {
          if (chrome.runtime.lastError) {
            console.error(chrome.i18n.getMessage("logErrorSavingStyle"), chrome.runtime.lastError.message);
          } else {
            console.log(chrome.i18n.getMessage("logStyleCopied"));
          }
        });
      }
      // Warnings for no style are handled within getSelectedStyleFromPage
    } else {
      // console.warn("Format Brush: Injection script for copy format did not return a valid result object."); // Optional
    }
  }).catch(err => console.error(chrome.i18n.getMessage("logGeneralError"), "in executeScript promise for copy:", err));
}

function executePasteFormat(tab) {
  if (!tab || !tab.id) {
    console.error(chrome.i18n.getMessage("logGeneralError"), "Invalid tab object for paste operation.");
    return;
  }
  chrome.storage.local.get("copiedGmailStyle", (data) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.i18n.getMessage("logErrorRetrievingStyle"), chrome.runtime.lastError.message);
      return;
    }
    const styleToApply = data.copiedGmailStyle;
    if (styleToApply) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: applyStyleToSelectionInPage,
        args: [styleToApply]
      }).then(() => {
          if (chrome.runtime.lastError) {
              console.error(chrome.i18n.getMessage("logErrorInjectingScript"), "for paste:", chrome.runtime.lastError.message);
          } else {
              console.log(chrome.i18n.getMessage("logPasteExecuted"));
          }
      }).catch(err => console.error(chrome.i18n.getMessage("logGeneralError"), "in executeScript promise for paste:", err));
    } else {
      console.warn(chrome.i18n.getMessage("logNoStyleToPaste"));
    }
  });
}

// Event Listeners
chrome.runtime.onInstalled.addListener((details) => {
  console.log(chrome.i18n.getMessage("extName") + ": " + details.reason + ". Initializing...");
  chrome.storage.local.set({ copiedGmailStyle: null });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID_COPY,
    title: chrome.i18n.getMessage("contextMenuCopyTitle"),
    contexts: ["selection"],
    documentUrlPatterns: ["*://mail.google.com/*"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID_PASTE,
    title: chrome.i18n.getMessage("contextMenuPasteTitle"),
    contexts: ["selection"],
    documentUrlPatterns: ["*://mail.google.com/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
    // console.log(chrome.i18n.getMessage("logNotGmailTab")); 
    return;
  }
  if (!tab.id) {
    console.error(chrome.i18n.getMessage("logGeneralError"), "Tab ID not available for context menu action.");
    return;
  }

  if (info.menuItemId === CONTEXT_MENU_ID_COPY) {
    executeCopyFormat(tab);
  } else if (info.menuItemId === CONTEXT_MENU_ID_PASTE) {
    executePasteFormat(tab);
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
    // console.log(chrome.i18n.getMessage("logNotGmailTab")); 
    return;
  }
  if (!tab.id) {
    console.error(chrome.i18n.getMessage("logGeneralError"), "Tab ID not available for command action.");
    return;
  }

  if (command === "copy-format") {
    executeCopyFormat(tab);
  } else if (command === "paste-format") {
    executePasteFormat(tab);
  }
});


function getSelectedStyleFromPage() {
  const activeElement = document.activeElement;
  const composeBody = activeElement && activeElement.isContentEditable &&
                      (activeElement.getAttribute('aria-label') === 'Текст письма' || // Russian
                       activeElement.getAttribute('aria-label') === 'Message Body' || // English
                       activeElement.getAttribute('aria-label') === 'Cuerpo del mensaje' || // Spanish
                       activeElement.getAttribute('aria-label') === 'Corpo da mensagem' || // Portuguese
                       activeElement.getAttribute('aria-label') === 'Corps du message' || // French
                       activeElement.getAttribute('aria-label') === 'Nachrichtentext' || // German
                       activeElement.getAttribute('aria-label') === '正文' || // Chinese (Simplified)
                       activeElement.getAttribute('aria-label') === 'نص الرسالة' || // Arabic
                       activeElement.classList.contains('Am') || // Generic Gmail class
                       activeElement.getAttribute('g_editable') === 'true');

  if (!composeBody) {
    console.warn("Format Brush (Page): Get: Not in a recognized Gmail compose area.");
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    console.warn("Format Brush (Page): Get: No text selected or selection is collapsed.");
    return null;
  }

  const range = selection.getRangeAt(0);
  let elementToStyle = range.startContainer;

  if (elementToStyle.nodeType === Node.TEXT_NODE) {
    elementToStyle = elementToStyle.parentElement;
  }

  if (!elementToStyle || typeof elementToStyle.style === 'undefined' || !elementToStyle.tagName) {
      if (range.commonAncestorContainer) {
          elementToStyle = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ?
                           range.commonAncestorContainer :
                           range.commonAncestorContainer.parentElement;
      }
      if (!elementToStyle || typeof elementToStyle.style === 'undefined' || !elementToStyle.tagName) {
          if (activeElement && activeElement.isContentEditable && activeElement.style) {
              elementToStyle = activeElement;
          } else {
              console.error("Format Brush (Page): Get: Could not determine a valid element for style computation.");
              return null;
          }
      }
  }

  const computedStyle = window.getComputedStyle(elementToStyle);
  let fontWeight = computedStyle.fontWeight;
  let fontStyle = computedStyle.fontStyle;
  let textDecoration = computedStyle.textDecoration;
  let textDecorationColor = computedStyle.textDecorationColor;

  let currentElementForTraversal = elementToStyle;
  for (let i = 0; i < 3; i++) {
      if (!currentElementForTraversal || !currentElementForTraversal.parentElement || !currentElementForTraversal.parentElement.closest('[g_editable="true"], .editable, .Am')) {
          break;
      }
      const parentEl = currentElementForTraversal.parentElement;
      if (!parentEl || !parentEl.style) break;
      const parentComputedStyle = window.getComputedStyle(parentEl);

      if ((fontWeight === '400' || fontWeight === 'normal') && (parentEl.tagName === 'B' || parentComputedStyle.fontWeight === '700' || parentComputedStyle.fontWeight === 'bold')) {
          if (parentComputedStyle.fontWeight !== '400' && parentComputedStyle.fontWeight !== 'normal') fontWeight = parentComputedStyle.fontWeight;
      }
      if ((fontStyle === 'normal' || fontStyle === 'inherit' || fontStyle === 'initial') && (parentEl.tagName === 'I' || parentEl.tagName === 'EM' || parentComputedStyle.fontStyle === 'italic')) {
          if (parentComputedStyle.fontStyle !== 'normal') fontStyle = parentComputedStyle.fontStyle;
      }
      
      const currentIsNoneOrNotUnderline = textDecoration.toLowerCase().includes('none') || !textDecoration.toLowerCase().includes('underline');
      const parentIsUOrUnderlined = parentEl.tagName === 'U' || (parentComputedStyle.textDecoration && parentComputedStyle.textDecoration.toLowerCase().includes('underline'));

      if (currentIsNoneOrNotUnderline && parentIsUOrUnderlined) {
          textDecoration = parentComputedStyle.textDecoration;
          textDecorationColor = parentComputedStyle.textDecorationColor;
      }
      currentElementForTraversal = parentEl;
  }

  if (!textDecoration.toLowerCase().includes('underline')) {
    textDecoration = 'none';
  }

  const isTransparentBg = computedStyle.backgroundColor === 'transparent' || computedStyle.backgroundColor === 'rgba(0, 0, 0, 0)';
  const backgroundColor = isTransparentBg ? 'rgb(255, 255, 255)' : computedStyle.backgroundColor;

  const relevantStyles = {
    color: computedStyle.color,
    backgroundColor: backgroundColor,
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: fontWeight,
    fontStyle: fontStyle,
    textDecoration: textDecoration,
    textDecorationColor: textDecorationColor,
  };
  return relevantStyles;
}

function applyStyleToSelectionInPage(stylesToApply) {
  if (!stylesToApply) {
    console.warn("Format Brush (Page): Apply: No stylesToApply object received.");
    return;
  }

  const activeElement = document.activeElement;
    const composeBody = activeElement && activeElement.isContentEditable &&
                      (activeElement.getAttribute('aria-label') === 'Текст письма' || // Russian
                       activeElement.getAttribute('aria-label') === 'Message Body' || // English
                       activeElement.getAttribute('aria-label') === 'Cuerpo del mensaje' || // Spanish
                       activeElement.getAttribute('aria-label') === 'Corpo da mensagem' || // Portuguese
                       activeElement.getAttribute('aria-label') === 'Corps du message' || // French
                       activeElement.getAttribute('aria-label') === 'Nachrichtentext' || // German
                       activeElement.getAttribute('aria-label') === '正文' || // Chinese (Simplified)
                       activeElement.getAttribute('aria-label') === 'نص الرسالة' || // Arabic
                       activeElement.classList.contains('Am') || // Generic Gmail class
                       activeElement.getAttribute('g_editable') === 'true');
  if (!composeBody) {
    console.warn("Format Brush (Page): Apply: Not in a recognized Gmail compose area.");
    return;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn("Format Brush (Page): Apply: No selection range.");
    return;
  }
  if (selection.isCollapsed) {
    console.warn("Format Brush (Page): Apply: Selection is collapsed. Nothing to apply style to.");
    return;
  }

  const range = selection.getRangeAt(0);
  let targetFormattingSpan = null;
  let reStyledExisting = false;

  const commonAncestor = range.commonAncestorContainer;
  let elementToCheckForReuse = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentElement : commonAncestor;

  for(let i=0; i<3 && elementToCheckForReuse && elementToCheckForReuse !== composeBody && elementToCheckForReuse.getAttribute; i++) {
      if(elementToCheckForReuse.getAttribute('data-format-brush-applied') === 'true') {
          const contentRange = document.createRange();
          contentRange.selectNodeContents(elementToCheckForReuse);
          if (range.compareBoundaryPoints(Range.START_TO_START, contentRange) === 0 &&
              range.compareBoundaryPoints(Range.END_TO_END, contentRange) === 0) {
              targetFormattingSpan = elementToCheckForReuse;
              reStyledExisting = true;
              break;
          } else if (range.toString().trim() === elementToCheckForReuse.textContent.trim() &&
                     range.toString().trim().length > 0 &&
                     elementToCheckForReuse.contains(range.startContainer) &&
                     elementToCheckForReuse.contains(range.endContainer)) {
              targetFormattingSpan = elementToCheckForReuse;
              reStyledExisting = true;
              break;
          }
      }
      if (!elementToCheckForReuse.parentElement) break;
      elementToCheckForReuse = elementToCheckForReuse.parentElement;
  }

  const selectedContents = range.extractContents();

  if (reStyledExisting && targetFormattingSpan) {
      while (targetFormattingSpan.firstChild) {
          targetFormattingSpan.removeChild(targetFormattingSpan.firstChild);
      }
  } else {
      targetFormattingSpan = document.createElement('span');
      targetFormattingSpan.setAttribute('data-format-brush-applied', 'true');
      range.insertNode(targetFormattingSpan);
      reStyledExisting = false;
  }

  targetFormattingSpan.appendChild(selectedContents);

  const importantFlag = 'important';

  function applyCoreStylesToElement(element, styles) {
    if (!element || !element.style) return;
    element.style.cssText = ''; // Clear existing inline styles

    element.style.setProperty('color', styles.color, importantFlag);
    element.style.setProperty('background-color', styles.backgroundColor, importantFlag);
    element.style.setProperty('font-family', styles.fontFamily, importantFlag);
    element.style.setProperty('font-size', styles.fontSize, importantFlag);
    element.style.setProperty('font-weight', (styles.fontWeight === 'normal' || styles.fontWeight === '400') ? '400' : styles.fontWeight, importantFlag);
    element.style.setProperty('font-style', styles.fontStyle === 'normal' ? 'normal' : styles.fontStyle, importantFlag);

    element.style.removeProperty('text-decoration');
    element.style.removeProperty('text-decoration-line');
    element.style.removeProperty('text-decoration-color');
    element.style.removeProperty('text-decoration-style');
    element.style.removeProperty('text-decoration-thickness');

    if (styles.textDecoration && styles.textDecoration.toLowerCase().includes('underline')) {
        element.style.setProperty('text-decoration-line', 'underline', importantFlag);
        const uColor = (styles.textDecorationColor &&
                        styles.textDecorationColor.toLowerCase() !== 'rgba(0, 0, 0, 0)' &&
                        styles.textDecorationColor.toLowerCase() !== styles.color.toLowerCase())
                        ? styles.textDecorationColor
                        : styles.color;
        element.style.setProperty('text-decoration-color', uColor, importantFlag);
        element.style.setProperty('text-decoration-style', 'solid', importantFlag);
    } else {
        element.style.setProperty('text-decoration', 'none', importantFlag);
    }
  }

  applyCoreStylesToElement(targetFormattingSpan, stylesToApply);

  function processChildNodesRecursive(parentNode, styles) {
      parentNode.childNodes.forEach(childNode => {
          if (childNode.nodeType === Node.ELEMENT_NODE) {
              if (childNode.getAttribute('data-format-brush-applied') !== 'true') {
                applyCoreStylesToElement(childNode, styles);
              }
              if (childNode.hasChildNodes()) {
                  processChildNodesRecursive(childNode, styles);
              }
          }
      });
  }
  processChildNodesRecursive(targetFormattingSpan, stylesToApply);

  selection.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(targetFormattingSpan);
  selection.addRange(newRange);
}
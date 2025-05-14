// content_script.js (Word-by-Word Formatting Logic - v0.3.1 equivalent)
const EXTENSION_PREFIX_CS = "[WordFormatCS]";
const WORD_STYLES_STORAGE_KEY = "wordStyleMap_v1.1"; // Slightly updated key for fresh testing

console.log(EXTENSION_PREFIX_CS, `Word-by-Word Formatting Script Loaded (v0.3.1). Frame URL: ${window.location.href}. Timestamp: ${new Date().toLocaleTimeString()}`);

const RELEVANT_STYLE_PROPERTIES = [
  'color', 'backgroundColor',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'textDecorationLine', 'textDecorationColor', 'textDecorationStyle',
  'verticalAlign', 'lineHeight',
  // Add more specific properties if needed, but test performance
];

// Updated helper to extract defined styles, now more inclusive and element-aware
function extractDefinedStyles(element, computedStyle) {
  const styles = {};
  // console.log(EXTENSION_PREFIX_CS, "extractDefinedStyles for element:", element, "Computed styles to check:", RELEVANT_STYLE_PROPERTIES);

  RELEVANT_STYLE_PROPERTIES.forEach(prop => {
    let value = computedStyle[prop];
    // More inclusive logic: captures more, but might include "defaults".
    // We filter out common 'inherit', 'initial', 'unset' which usually don't represent an active styling choice.
    if (value !== undefined && value !== null && value !== '' &&
        value !== 'inherit' && value !== 'initial' && value !== 'unset') {

      // Retain 'normal' for properties like fontWeight or fontStyle if it's different from a typical default,
      // or if it's actively set. For this pass, we'll be more inclusive.
      // Example: if an element is explicitly set to font-weight: normal, we should capture it.
      
      // Specific handling for default-like values that might be important:
      if (prop === 'backgroundColor' && (value === 'rgba(0, 0, 0, 0)' || value === 'transparent')) {
         styles[prop] = value; // Capture explicit transparency
      } else if (prop === 'textDecorationLine' && value === 'none') {
         // Only capture 'text-decoration: none' if it's likely overriding a parent's decoration.
         // This is hard to tell without parent context. For now, let's capture it if found.
         styles[prop] = value;
      }
      // Avoid capturing common default black/grey text colors if not explicitly set on the element's inline style,
      // as these often come from browser defaults or broad stylesheet rules.
      // However, if a user *wants* to copy "default black text" style, this filtering is counterproductive.
      // For this more inclusive test, let's capture most things.
      else if (value !== 'normal' || 
                (prop === 'fontWeight' && value === 'normal' && element.style.fontWeight) || // Capture inline 'normal'
                (prop === 'fontStyle' && value === 'normal' && element.style.fontStyle) ) { // Capture inline 'normal'
         styles[prop] = value;
      }
    }
  });

  // Ensure basic semantic tag styles are considered if not strongly overridden by CSS
  // This helps if an element is <b> but its computed fontWeight became 'normal' due to other CSS.
  // We want to reflect the *intent* of the tag if possible, or the actual computed visual.
  const tagName = element.tagName.toLowerCase();
  const currentFontWeight = parseInt(computedStyle.fontWeight) || 400;

  if (tagName === 'b' || tagName === 'strong') {
    if (!styles.fontWeight || parseInt(styles.fontWeight) < 500) { // If no strong weight is already captured or it's normal
        styles.fontWeight = computedStyle.fontWeight !== 'normal' && parseInt(computedStyle.fontWeight) >=500 ? computedStyle.fontWeight : 'bold';
    }
  }
  if (tagName === 'i' || tagName === 'em') {
    if (!styles.fontStyle || styles.fontStyle === 'normal') {
        styles.fontStyle = computedStyle.fontStyle !== 'normal' ? computedStyle.fontStyle : 'italic';
    }
  }
  if (tagName === 'u') {
    if (!styles.textDecorationLine || styles.textDecorationLine === 'none') {
        if (computedStyle.textDecorationLine.includes('underline') || computedStyle.textDecoration.includes('underline')) {
             styles.textDecorationLine = computedStyle.textDecorationLine !== 'none' ? computedStyle.textDecorationLine : 'underline'; // Prioritize computed
        }
    }
  }
  // Add s, strike, sup, sub similarly if needed, checking computedStyle first.

  // console.log(EXTENSION_PREFIX_CS, "Extracted styles for element:", element, styles);
  return styles;
}


function generateWordStyleMapFromSelection() {
  console.log(EXTENSION_PREFIX_CS, `COPY (Word): Active Frame: ${window.location.href}, Focus: ${document.hasFocus()}`);
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    console.warn(EXTENSION_PREFIX_CS, "COPY (Word): No valid selection. isCollapsed:", selection?.isCollapsed, "rangeCount:", selection?.rangeCount);
    return null;
  }

  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents(); // This fragment contains the selected nodes
  const tempDiv = document.createElement('div'); // Temporary container to traverse
  tempDiv.appendChild(fragment);

  const wordStyleMap = [];
  
  // Recursive function to traverse nodes and extract styles for text parts
  function traverseNodesForWordStyles(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      // Split text into sequences of non-whitespace (words) and whitespace.
      const parts = text.match(/\S+|\s+/g) || []; 
      
      if (parts.length > 0) {
        // Styles are determined by the parent HTML element of this text node
        const parentElement = node.parentElement || tempDiv; // Use tempDiv if text node is somehow a direct child
        const computedStyle = window.getComputedStyle(parentElement);
        const stylesForTheseParts = extractDefinedStyles(parentElement, computedStyle); // Pass element and its style
        
        parts.forEach(part => {
          if (part.trim() !== '') { // It's a word (non-whitespace)
            wordStyleMap.push({ type: 'word', styles: { ...stylesForTheseParts } });
          } else { // It's whitespace
            // Store whitespace with the styles of the element it was in.
            // This helps if the whitespace itself contributes to layout/styling (e.g. background color).
            wordStyleMap.push({ type: 'space', text: part, styles: { ...stylesForTheseParts } });
          }
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // If it's an element, recurse for its children.
      // The styles will be picked up from the parent of the text nodes found within.
      Array.from(node.childNodes).forEach(child => traverseNodesForWordStyles(child));
    }
  }

  traverseNodesForWordStyles(tempDiv); // Start traversal

  if (wordStyleMap.length === 0) {
    console.warn(EXTENSION_PREFIX_CS, "COPY (Word): No words or styled segments identified in the selection.");
    return null;
  }
  
  // Using JSON.stringify/parse for a deep clone for logging, so the actual objects aren't modified by console expansion
  console.log(EXTENSION_PREFIX_CS, "COPY (Word): Generated Word Style Map:", JSON.parse(JSON.stringify(wordStyleMap)));
  return wordStyleMap;
}


function applyWordStylesToTarget(sourceWordStyleMap) {
  console.log(EXTENSION_PREFIX_CS, `PASTE (Word): Active Frame: ${window.location.href}, Focus: ${document.hasFocus()}`);
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    console.warn(EXTENSION_PREFIX_CS, "PASTE (Word): No selection range to paste onto.");
    return;
  }
  if (!sourceWordStyleMap || sourceWordStyleMap.length === 0) {
    console.warn(EXTENSION_PREFIX_CS, "PASTE (Word): No source word styles provided to apply.");
    return;
  }

  const targetRange = selection.getRangeAt(0);
  
  // If pasting into a collapsed selection (cursor), it's tricky for "format only word-by-word".
  // This mode expects target text to map to source styles.
  // For now, we'll require a non-collapsed selection for this specific paste mode.
  if (selection.isCollapsed) {
      console.warn(EXTENSION_PREFIX_CS, "PASTE (Word): Selection is collapsed. Please select target text to apply word-by-word formatting.");
      // Alternative: could paste the source words with their styles, but that's not "format only."
      return;
  }
  
  const targetFragment = targetRange.extractContents(); // Get and remove target content
  const tempTargetDiv = document.createElement('div');
  tempTargetDiv.appendChild(targetFragment);
  
  const targetParts = []; // Array to hold target words and space strings
  function extractTargetPartsRecursive(node) {
      if (node.nodeType === Node.TEXT_NODE) {
          const parts = node.textContent.match(/\S+|\s+/g) || [];
          parts.forEach(p => targetParts.push(p));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
          Array.from(node.childNodes).forEach(child => extractTargetPartsRecursive(child));
      }
  }
  extractTargetPartsRecursive(tempTargetDiv);

  if (targetParts.length === 0) {
      console.warn(EXTENSION_PREFIX_CS, "PASTE (Word): Target selection yielded no words or spaces to format.");
      targetRange.insertNode(tempTargetDiv.firstChild || document.createTextNode("")); // Put back original if empty
      return;
  }

  console.log(EXTENSION_PREFIX_CS, "PASTE (Word): Source Style Map Count:", sourceWordStyleMap.length);
  console.log(EXTENSION_PREFIX_CS, "PASTE (Word): Target Parts (words/spaces to be styled):", targetParts);

  // targetRange is now collapsed where the content was extracted.
  // We will insert new styled spans (for words) and text nodes (for spaces) one by one.
  
  const fragmentToInsert = document.createDocumentFragment();
  let sourceStyleMapWordIndex = 0; // Index for 'word' type styles from source
  let lastAppliedWordStyle = {}; // Fallback style

  for (let i = 0; i < targetParts.length; i++) {
    const currentTargetPartText = targetParts[i];
    
    if (currentTargetPartText.trim() !== '') { // It's a word
      let stylesToApply = lastAppliedWordStyle; // Default to last used style for words

      // Find the next available 'word' style from the source map
      let foundStyleForThisWord = false;
      while(sourceStyleMapWordIndex < sourceWordStyleMap.length) {
          if (sourceWordStyleMap[sourceStyleMapWordIndex].type === 'word') {
              stylesToApply = sourceWordStyleMap[sourceStyleMapWordIndex].styles;
              lastAppliedWordStyle = stylesToApply; // Update for next potential fallback
              sourceStyleMapWordIndex++;
              foundStyleForThisWord = true;
              break;
          }
          // If source map has 'space' entries, skip them when looking for a 'word' style
          sourceStyleMapWordIndex++; 
      }
      if (!foundStyleForThisWord && sourceWordStyleMap.length > 0) {
          // If we ran out of distinct source *word* styles but had some, use the style of the very last source word encountered
          for (let k = sourceWordStyleMap.length - 1; k >= 0; k--) {
              if (sourceWordStyleMap[k].type === 'word') {
                  lastAppliedWordStyle = sourceWordStyleMap[k].styles;
                  stylesToApply = lastAppliedWordStyle;
                  break;
              }
          }
      }
      
      const span = document.createElement('span');
      Object.entries(stylesToApply).forEach(([prop, value]) => {
        // Ensure value is string, as style property expects string
        if (typeof value === 'string' || typeof value === 'number') {
            span.style[prop] = value;
        }
      });
      span.textContent = currentTargetPartText;
      fragmentToInsert.appendChild(span);

    } else { // It's a space or sequence of whitespace
      // For spaces, we could try to apply styles if source spaces had them,
      // or use the style of the preceding word. For simplicity, let's make them plain text for now,
      // or try to use the style of the *source space* if available.
      // The current `generateWordStyleMapFromSelection` *does* store styles for spaces.
      let spaceStyle = {};
      let foundSourceSpaceStyle = null;
      // Attempt to find a corresponding space style (this is a simple sequential match, might not be perfect)
      // This part of logic could be refined if space styling is critical.
      // For now, just inserting plain space to keep it simple.
      // TODO: More sophisticated space style matching if needed.
      fragmentToInsert.appendChild(document.createTextNode(currentTargetPartText));
    }
  }

  targetRange.insertNode(fragmentToInsert);
  console.log(EXTENSION_PREFIX_CS, "PASTE (Word): Word-by-word formatting applied to target text.");
  
  // Re-selection logic (simplified, might need adjustment)
  if (fragmentToInsert.firstChild && fragmentToInsert.lastChild) {
      selection.removeAllRanges();
      const newRange = document.createRange();
      try {
          newRange.setStartBefore(fragmentToInsert.firstChild);
          newRange.setEndAfter(fragmentToInsert.lastChild);
          selection.addRange(newRange);
      } catch (e) {
          console.warn(EXTENSION_PREFIX_CS, "PASTE (Word): Could not re-select precise content.", e);
      }
  }
}


// --- Handlers for calls from Background Script ---
// Ensure these function names (richFormatCopier_doCopy/Paste) match what background.js calls
window.richFormatCopier_doCopy = () => {
  const frameUrl = window.location.href;
  console.log(EXTENSION_PREFIX_CS, `ACTION HANDLER (Word): richFormatCopier_doCopy. Frame: ${frameUrl}, Focus: ${document.hasFocus()}`);
  const currentSelection = window.getSelection();
  if (!document.hasFocus() && (!currentSelection || currentSelection.isCollapsed || currentSelection.rangeCount === 0)) {
    console.log(EXTENSION_PREFIX_CS, `_doCopy: Skipping in frame ${frameUrl} - no focus or no valid selection.`);
    return; 
  }
  const wordStyleMap = generateWordStyleMapFromSelection();
  if (wordStyleMap) {
    chrome.storage.local.set({ [WORD_STYLES_STORAGE_KEY]: wordStyleMap }, () => {
      if (chrome.runtime.lastError) console.error(EXTENSION_PREFIX_CS, "Storage SET Error:", chrome.runtime.lastError.message);
      else console.log(EXTENSION_PREFIX_CS, "Word Style Map saved. Count:", wordStyleMap.length);
    });
  } else {
    console.warn(EXTENSION_PREFIX_CS, `No Word Style Map copied from ${frameUrl}.`);
  }
};

window.richFormatCopier_doPaste = () => {
  const frameUrl = window.location.href;
  console.log(EXTENSION_PREFIX_CS, `ACTION HANDLER (Word): richFormatCopier_doPaste. Frame: ${frameUrl}, Focus: ${document.hasFocus()}`);
  const currentSelection = window.getSelection();
   if (!document.hasFocus() && (!currentSelection || currentSelection.rangeCount === 0 )) {
     // isCollapsed is handled within applyWordStylesToTarget now
    console.log(EXTENSION_PREFIX_CS, `_doPaste: Skipping in frame ${frameUrl} - no focus or no selection range.`);
    return;
  }
  chrome.storage.local.get([WORD_STYLES_STORAGE_KEY], (data) => {
    if (chrome.runtime.lastError) {
      console.error(EXTENSION_PREFIX_CS, "Storage GET Error:", chrome.runtime.lastError.message);
      return;
    }
    const wordStyleMap = data[WORD_STYLES_STORAGE_KEY];
    if (wordStyleMap && wordStyleMap.length > 0) {
      applyWordStylesToTarget(wordStyleMap);
    } else {
      console.warn(EXTENSION_PREFIX_CS, `No Word Style Map in storage to paste in ${frameUrl}.`);
    }
  });
};

// Listener for context menu messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const frameUrl = window.location.href;
  console.log(EXTENSION_PREFIX_CS, `Message in frame ${frameUrl} (Word):`, message);

  // Ensure message.source matches what background.js sends (e.g., "contextMenu_v3")
  if (message.source === "contextMenu_v3") { 
    if (message.action === "copyRichFormatRequested") { // Ensure action name matches
      console.log(EXTENSION_PREFIX_CS, "ACTION HANDLER (Word): Context Menu Copy. Frame:", frameUrl);
      const wordStyleMap = generateWordStyleMapFromSelection();
      if (wordStyleMap) {
        chrome.storage.local.set({ [WORD_STYLES_STORAGE_KEY]: wordStyleMap }, () => {
          if (chrome.runtime.lastError) sendResponse({ status: "Error saving Word Style Map", error: chrome.runtime.lastError.message });
          else sendResponse({ status: "Word Style Map copied" });
        });
        return true; // Async response
      } else {
        sendResponse({ status: "Failed to copy Word Style Map" });
      }
    } else if (message.action === "pasteRichFormatRequested") { // Ensure action name matches
      console.log(EXTENSION_PREFIX_CS, "ACTION HANDLER (Word): Context Menu Paste. Frame:", frameUrl);
      chrome.storage.local.get([WORD_STYLES_STORAGE_KEY], (data) => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: "Error retrieving Word Style Map", error: chrome.runtime.lastError.message });
          return;
        }
        const wordStyleMap = data[WORD_STYLES_STORAGE_KEY];
        if (wordStyleMap && wordStyleMap.length > 0) {
          applyWordStylesToTarget(wordStyleMap);
          sendResponse({ status: "Word Style Map applied" });
        } else {
          sendResponse({ status: "No Word Style Map to paste" });
        }
      });
      return true; // Async response
    }
  }
});

// Confirm functions are set on window
// These names MUST match what background.js's executeScript 'func' calls
if (typeof window.richFormatCopier_doCopy === 'function') {
  console.log(EXTENSION_PREFIX_CS, 'CONFIRM: window.richFormatCopier_doCopy is set.');
} else {
  console.error(EXTENSION_PREFIX_CS, 'CRITICAL: window.richFormatCopier_doCopy IS NOT SET.');
}
if (typeof window.richFormatCopier_doPaste === 'function') {
  console.log(EXTENSION_PREFIX_CS, 'CONFIRM: window.richFormatCopier_doPaste is set.');
} else {
  console.error(EXTENSION_PREFIX_CS, 'CRITICAL: window.richFormatCopier_doPaste IS NOT SET.');
}
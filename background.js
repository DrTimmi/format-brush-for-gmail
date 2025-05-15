// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Gmail Format Copier: Installed/Updated. Further refined re-style logic.");
  chrome.storage.local.set({ copiedGmailStyle: null });
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab.url || !tab.url.includes("mail.google.com")) {
    console.log("Format Copier: Not a Gmail tab. Command ignored.");
    return;
  }

  if (command === "copy-format") {
    console.log("Format Copier: Copy format command triggered");
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectedStyleFromPage
    }).then((injectionResults) => {
      if (chrome.runtime.lastError) {
        console.error("Format Copier: Error injecting script for copy: ", chrome.runtime.lastError.message);
        return;
      }
      if (injectionResults && injectionResults.length > 0 && injectionResults[0].result) {
        const style = injectionResults[0].result;
        if (style) {
          chrome.storage.local.set({ copiedGmailStyle: style }, () => {
            if (chrome.runtime.lastError) {
              console.error("Format Copier: Error saving style: ", chrome.runtime.lastError.message);
            } else {
              console.log("Format Copier: Style COPIED AND SAVED:", JSON.parse(JSON.stringify(style)));
            }
          });
        } else {
          console.log("Format Copier: No style information could be retrieved (getSelectedStyleFromPage returned null).");
        }
      } else {
        console.log("Format Copier: Injection script for copy format did not return a valid result object.");
         if (injectionResults && injectionResults[0] && injectionResults[0].error) {
            console.error("Format Copier: Injection error detail:", injectionResults[0].error);
        }
      }
    }).catch(err => console.error("Format Copier: Error in executeScript promise for copy:", err));

  } else if (command === "paste-format") {
    console.log("Format Copier: Paste format command triggered");
    chrome.storage.local.get("copiedGmailStyle", (data) => {
      if (chrome.runtime.lastError) {
        console.error("Format Copier: Error retrieving style: ", chrome.runtime.lastError.message);
        return;
      }
      const styleToApply = data.copiedGmailStyle;
      if (styleToApply) {
        console.log("Format Copier: Retrieved style TO PASTE:", JSON.parse(JSON.stringify(styleToApply)));
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: applyStyleToSelectionInPage,
          args: [styleToApply]
        }).then(() => {
            if (chrome.runtime.lastError) {
                console.error("Format Copier: Error injecting script for paste: ", chrome.runtime.lastError.message);
            } else {
                console.log("Format Copier: Paste style function executed on page.");
            }
        }).catch(err => console.error("Format Copier: Error in executeScript promise for paste:", err));
      } else {
        console.log("Format Copier: No style found in storage to paste.");
      }
    });
  }
});

// getSelectedStyleFromPage (same as the version that correctly gets "none" for Druzhkov)
function getSelectedStyleFromPage() {
  const activeElement = document.activeElement;
  const composeBody = activeElement && activeElement.isContentEditable &&
                      (activeElement.getAttribute('aria-label') === 'Текст письма' ||
                       activeElement.getAttribute('aria-label') === 'Message Body' ||
                       activeElement.classList.contains('Am') ||
                       activeElement.getAttribute('g_editable') === 'true');

  if (!composeBody) {
    console.warn("Format Copier: Get: Not in a recognized Gmail compose area.");
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn("Format Copier: Get: No text selected.");
    return null;
  }

  const range = selection.getRangeAt(0);
  let elementToStyle = range.startContainer;

  if (elementToStyle.nodeType === Node.TEXT_NODE) {
    elementToStyle = elementToStyle.parentElement;
  }

  if (!elementToStyle || typeof elementToStyle.style === 'undefined' || !elementToStyle.tagName) {
    if (!selection.isCollapsed && range.commonAncestorContainer) {
        elementToStyle = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    }
    if (!elementToStyle || typeof elementToStyle.style === 'undefined' || !elementToStyle.tagName) {
        console.error("Format Copier: Get: Could not determine valid elementToStyle even after fallback.");
        if (activeElement && activeElement.isContentEditable && activeElement.style) {
            elementToStyle = activeElement;
            console.warn("Format Copier: Get: Falling back to activeElement for style computation.", elementToStyle);
        } else {
            return null;
        }
    }
  }
  console.log("Format Copier: Get: Initial element for getComputedStyle:", elementToStyle.tagName, elementToStyle);

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
          console.log("Format Copier: Get: Overriding text-decoration from parent ", parentEl.tagName, ". Parent's full textDecoration:", parentComputedStyle.textDecoration);
          textDecoration = parentComputedStyle.textDecoration;
          textDecorationColor = parentComputedStyle.textDecorationColor;
      }
      currentElementForTraversal = parentEl;
  }

  const tdParts = textDecoration.toLowerCase().split(' ');
  if (tdParts.includes('none')) {
      textDecoration = 'none';
      console.log("Format Copier: Get: Simplified textDecoration to 'none'.");
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
    borderBottomStyle: computedStyle.borderBottomStyle,
    borderBottomWidth: computedStyle.borderBottomWidth,
    borderBottomColor: computedStyle.borderBottomColor,
  };
  console.log("Format Copier: Get: Final effective styles being returned from content script:", JSON.parse(JSON.stringify(relevantStyles)));
  return relevantStyles;
}

// applyStyleToSelectionInPage with more robust re-style logic
function applyStyleToSelectionInPage(stylesToApply) {
  if (!stylesToApply) { console.warn("Format Copier: Apply: No stylesToApply object."); return; }
  console.log("Format Copier: Apply: Received stylesToApply:", JSON.parse(JSON.stringify(stylesToApply)));

  const activeElement = document.activeElement;
  const composeBody = activeElement && activeElement.isContentEditable &&
                      (activeElement.getAttribute('aria-label') === 'Текст письма' ||
                       activeElement.getAttribute('aria-label') === 'Message Body' ||
                       activeElement.classList.contains('Am') ||
                       activeElement.getAttribute('g_editable') === 'true');

  if (!composeBody) { console.warn("Format Copier: Apply: Not in Gmail compose area."); return; }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) { console.warn("Format Copier: Apply: No selection range."); return; }
  if (selection.isCollapsed) { console.warn("Format Copier: Apply: Selection is collapsed."); return; }

  const range = selection.getRangeAt(0);
  let targetFormattingSpan = null;
  let reStyledExisting = false;

  // --- More robust logic to find and re-use existing wrapper span ---
  const commonAncestor = range.commonAncestorContainer;
  let elementToCheckForReuse = null;

  if (commonAncestor.nodeType === Node.TEXT_NODE) {
      elementToCheckForReuse = commonAncestor.parentElement;
  } else if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      elementToCheckForReuse = commonAncestor;
  }

  // Traverse up from elementToCheckForReuse to find our span
  let currentTraversalElement = elementToCheckForReuse;
  for(let i=0; i<3 && currentTraversalElement && currentTraversalElement !== composeBody && currentTraversalElement.getAttribute; i++) {
      if(currentTraversalElement.getAttribute('data-format-copier-applied') === 'true') {
          const contentRange = document.createRange();
          contentRange.selectNodeContents(currentTraversalElement);
          
          // Check if the user's selection (range) is identical to the content of this span
          const selectionStartMatches = range.startContainer === contentRange.startContainer && range.startOffset === contentRange.startOffset;
          const selectionEndMatches = range.endContainer === contentRange.endContainer && range.endOffset === contentRange.endOffset;

          // More direct check: does the selection fully contain the content of this element,
          // and does this element fully contain the selection?
          // This means the selection range and the element's content range are effectively identical.
          if (range.compareBoundaryPoints(Range.START_TO_START, contentRange) === 0 &&
              range.compareBoundaryPoints(Range.END_TO_END, contentRange) === 0) {
              targetFormattingSpan = currentTraversalElement;
              reStyledExisting = true;
              console.log("Format Copier: Apply: Re-using existing formatting span (Boundary match):", targetFormattingSpan);
              break;
          } else {
                // Fallback text content match, only if the selection seems to be *within* this span.
                // This is to catch cases where precise boundary points might differ due to normalization.
                if (range.toString().trim() === currentTraversalElement.textContent.trim() &&
                    range.toString().trim().length > 0 &&
                    currentTraversalElement.contains(range.startContainer) &&
                    currentTraversalElement.contains(range.endContainer)) {
                        targetFormattingSpan = currentTraversalElement;
                        reStyledExisting = true;
                        console.log("Format Copier: Apply: Re-using existing formatting span (Text content match, selection within):", targetFormattingSpan);
                        break;
                } else {
                     console.log("Format Copier: Apply: Checked span, but selection did not fully match content based on boundaries or trimmed text.", {
                        selectedText: range.toString().trim(),
                        spanText: currentTraversalElement.textContent.trim(),
                        isBoundaryMatch: (range.compareBoundaryPoints(Range.START_TO_START, contentRange) === 0 && range.compareBoundaryPoints(Range.END_TO_END, contentRange) === 0)
                    });
                }
          }
      }
      if (!currentTraversalElement.parentElement) break;
      currentTraversalElement = currentTraversalElement.parentElement;
  }
  // --- End of re-use logic ---

  const selectedContents = range.extractContents(); // This removes the content from the DOM

  if (reStyledExisting && targetFormattingSpan) {
      while (targetFormattingSpan.firstChild) { // Clear out the old content of the re-used span
          targetFormattingSpan.removeChild(targetFormattingSpan.firstChild);
      }
      // targetFormattingSpan is already in the correct DOM position, we just emptied it.
      // The original `range` is now collapsed where the content was.
      // We need to re-insert the original range's position marker if we want to insert something else there,
      // but here, targetFormattingSpan is the destination.
  } else {
      targetFormattingSpan = document.createElement('span');
      targetFormattingSpan.setAttribute('data-format-copier-applied', 'true');
      range.insertNode(targetFormattingSpan); // Insert the new span at the (now empty) selection point
      console.log("Format Copier: Apply: Creating new formatting span at selection point.");
      reStyledExisting = false; // Ensure this is correctly set if new span was made
  }

  targetFormattingSpan.appendChild(selectedContents); // Add the extracted (and now unstyled by previous wrapper) content

  const useImportant = true; // Using !important for robustness

  function elementalApplyStylesTo(element, styles) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || !element.style) { return; }
    const importantFlag = useImportant ? 'important' : '';

    const propsToSet = {
        'color': styles.color, 'font-family': styles.fontFamily, 'font-size': styles.fontSize,
        'font-weight': styles.fontWeight, 'font-style': styles.fontStyle,
        'background-color': styles.backgroundColor
    };

    for (const prop in propsToSet) {
        const value = propsToSet[prop];
        if (value && value !== 'inherit' && value !== 'initial' && value !== 'auto') {
            if ((prop === 'font-weight' && (value === 'normal' || value === '400'))) {
                element.style.setProperty(prop, '400', importantFlag);
            } else if (prop === 'font-style' && value === 'normal') {
                element.style.setProperty(prop, 'normal', importantFlag);
            } else {
                element.style.setProperty(prop, value, importantFlag);
            }
        } else {
            element.style.removeProperty(prop);
            if (prop === 'font-weight') element.style.setProperty(prop, '400', importantFlag);
            if (prop === 'font-style') element.style.setProperty(prop, 'normal', importantFlag);
        }
    }

    console.log("Format Copier: Apply: current element <" + (element.tagName || 'Node') + ">, incoming styles.textDecoration = " + styles.textDecoration);
    const sourceShorthandIsEffectivelyNone = styles.textDecoration && styles.textDecoration.toLowerCase() === 'none';

    if (sourceShorthandIsEffectivelyNone) {
        console.log("Format Copier: Apply: Setting text-decoration to 'none' for <" + (element.tagName || 'Node') + ">");
        element.style.removeProperty('text-decoration-line');
        element.style.removeProperty('text-decoration-color');
        element.style.removeProperty('text-decoration-style');
        element.style.removeProperty('text-decoration-thickness');
        element.style.setProperty('text-decoration', 'none', importantFlag);
    } else if (styles.textDecoration && styles.textDecoration.toLowerCase().includes('underline')) {
        console.log("Format Copier: Apply: Applying underline text-decoration for <" + (element.tagName || 'Node') + "> based on shorthand: " + styles.textDecoration);
        element.style.removeProperty('text-decoration');
        element.style.setProperty('text-decoration-line', 'underline', importantFlag);
        const finalDecorationColor = (styles.textDecorationColor && styles.textDecorationColor.toLowerCase() !== styles.color.toLowerCase() && !styles.textDecorationColor.includes('rgba(0, 0, 0, 0)'))
                                     ? styles.textDecorationColor : (styles.color || 'initial');
        element.style.setProperty('text-decoration-color', finalDecorationColor, importantFlag);
        element.style.setProperty('text-decoration-style', 'solid', importantFlag);
        element.style.setProperty('text-decoration-thickness', 'auto', importantFlag);
    } else if (styles.textDecoration) {
        console.log("Format Copier: Apply: Applying other text-decoration shorthand for <" + (element.tagName || 'Node') + ">:", styles.textDecoration);
        element.style.setProperty('text-decoration', styles.textDecoration, importantFlag);
    } else {
         console.log("Format Copier: Apply: No text-decoration in source, ensuring 'none' for <" + (element.tagName || 'Node') + ">");
        element.style.setProperty('text-decoration', 'none', importantFlag);
    }
    console.log(`Format Copier: Apply: For <${element.tagName || 'Node'}>, after styling, element.style.textDecoration is:`, element.style.textDecoration);

    const sourceWantsNoBorderBottom = !styles.borderBottomStyle || styles.borderBottomStyle.toLowerCase() === 'none';
    if (sourceWantsNoBorderBottom) {
        element.style.setProperty('border-bottom', 'none', importantFlag);
    } else {
        element.style.setProperty('border-bottom-style', styles.borderBottomStyle, importantFlag);
        element.style.setProperty('border-bottom-width', styles.borderBottomWidth, importantFlag);
        element.style.setProperty('border-bottom-color', styles.borderBottomColor, importantFlag);
    }
    if (element.tagName === 'FONT' && styles.color && element.hasAttribute('color')) {
        element.removeAttribute('color');
    }
  }
  // --- End of elementalApplyStylesTo ---

  elementalApplyStylesTo(targetFormattingSpan, stylesToApply);
  function processChildNodesRecursive(parentNode, styles) {
      parentNode.childNodes.forEach(childNode => {
          if (childNode.nodeType === Node.ELEMENT_NODE) {
              elementalApplyStylesTo(childNode, styles);
              processChildNodesRecursive(childNode, styles);
          }
      });
  }
  processChildNodesRecursive(targetFormattingSpan, stylesToApply);

  selection.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(targetFormattingSpan);
  selection.addRange(newRange);
  console.log("Format Copier: Apply: Style application complete.");
}
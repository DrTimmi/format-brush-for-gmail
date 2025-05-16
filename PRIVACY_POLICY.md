# Privacy Policy for Format Brush for Gmail

**Last Updated:** May 16, 2025

Thank you for using Format Brush for Gmail (the "Extension"). This policy outlines how the Extension handles information.

**Information We Do Not Collect:**

The Extension **does not** collect, store, or transmit any personally identifiable information about you, such as your name, email address, Browse history (other than to identify that you are on a mail.google.com page for functionality), or the content of your emails.

**Information the Extension Handles Locally:**

* **Copied Text Styles:** When you use the "Copy Formatting" feature, the style information (such as font, color, size, bold, italics, underline, and background color) of the selected text is temporarily stored locally on your computer using the `chrome.storage.local` API.
* **Purpose:** This locally stored style information is used solely to enable the "Paste Formatting" feature of the Extension. It allows you to apply the copied style to other text within Gmail.
* **Data Persistence:** This style information remains on your local computer until you copy a new style (which overwrites the previous one) or until the extension's storage is cleared (e.g., if you uninstall the extension or clear browser data).
* **No Transmission:** This style information is **not** sent to any external servers or third parties by the Extension. All processing happens locally within your browser.

**Permissions:**

The Extension requires the following permissions to function:
* `activeTab` & `scripting`: To access the content of the currently active Gmail tab and inject scripts to read and apply text styles.
* `storage`: To store the copied text formatting style locally.
* `contextMenus`: To provide "Copy Formatting" and "Paste Formatting" options in the right-click menu.
* `commands`: To enable keyboard shortcuts for copying and pasting formats.

**Changes to This Privacy Policy:**

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the Extension's description or on its support page.

**Contact Us:**

If you have any questions about this Privacy Policy, please contact me at https://github.com/DrTimmi/format-brush-for-gmail/issues.

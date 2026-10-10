/**
 * Copies with a selected, invisible textarea and `execCommand('copy')`. This is the only way to copy when the
 * Clipboard API is missing, which Safari (iOS and macOS) does on any non-HTTPS page such as a LAN dev server.
 */
function copyWithSelection(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // iOS refuses to select text that is off-screen or hidden, and zooms into inputs smaller than 16px.
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.fontSize = '16px';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.select();
  // iOS ignores select() on its own; an explicit range is what actually selects the text.
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    if (previous && selection) {
      selection.removeAllRanges();
      selection.addRange(previous);
    }
  }
  return copied;
}

/** Copies text and reports whether the browser allowed it (clipboard access can be denied). */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or not focused: the selection fallback still works inside the same click.
      return copyWithSelection(text);
    }
  }
  return copyWithSelection(text);
}

/**
 * Copy text to the clipboard, robustly.
 *
 * `navigator.clipboard` only works in a secure context — notably it's BLOCKED when
 * the app is opened over a plain-http LAN IP on a phone (e.g. http://192.168.x.x),
 * which is exactly how you'd view it to send the list to your phone. So we fall back
 * to the legacy `execCommand("copy")` via a hidden textarea, which works there too.
 *
 * @returns true if the copy succeeded by either method.
 */
export async function copyText(text: string): Promise<boolean> {
  // Preferred path: async Clipboard API (secure contexts).
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  // Legacy fallback: a hidden textarea + document.execCommand("copy").
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

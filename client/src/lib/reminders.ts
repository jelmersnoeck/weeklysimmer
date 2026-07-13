// The name of the Apple Shortcut the user installs once (see the setup hint in the
// UI). It should: receive text → Split by New Lines → Repeat, adding each line as a
// Reminder to a chosen list.
export const REMINDERS_SHORTCUT_NAME = "Weekly Simmer Shopping";

/**
 * Build a `shortcuts://run-shortcut` deep link that runs the user's Apple Shortcut
 * with the given text as input. On iOS/macOS this hands the newline-separated list to
 * the Shortcut, which adds each line to Reminders. (Apple has no web bulk-add API;
 * the Shortcuts URL scheme is the supported path.)
 *
 * See: https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios
 */
export function remindersShortcutUrl(
  text: string,
  shortcutName: string = REMINDERS_SHORTCUT_NAME,
): string {
  const name = encodeURIComponent(shortcutName);
  const input = encodeURIComponent(text);
  return `shortcuts://run-shortcut?name=${name}&input=text&text=${input}`;
}

/**
 * Just LAUNCH the shortcut by name — no `input` param. The app copies the list to the
 * clipboard first; the shortcut reads it itself with a "Get Clipboard" action. This is
 * the reliable path: the URL's `input=clipboard`/`input=text` params are flaky on macOS
 * (e.g. `input=clipboard` passes the literal word "clipboard"), so we don't use them.
 */
export function remindersShortcutClipboardUrl(
  shortcutName: string = REMINDERS_SHORTCUT_NAME,
): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}`;
}

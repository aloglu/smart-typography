# Smart Typography

Smart Typography is a Firefox extension that quietly upgrades every text field with professional punctuation. It turns straight quotes into curly ones as you type, swaps ASCII shortcuts (like `->` or `...`) for their typographic counterparts, and even formats fractions with true glyphs or stacked numerators/denominators. A toolbar popup lets you pause the extension globally or toggle it per-site in one click.

## Features
- Replaces straight quotation marks with smart single (`‘ ’`) and double (`“ ”`) quotes in real time, including nested contexts.
- Converts common punctuation shortcuts into typographically correct characters without touching existing text.
- Detects typed fractions (e.g., `3/4`, `11/16`) and replaces them with dedicated Unicode glyphs or a superscript/subscript stack.
- Provides a popup UI with global and per-site switches plus live status labels for the active tab.
- Offers an escape hatch: prefix a quote with `\` to insert the literal straight character.
- Draws a colored line on the extension icon so you can see whether Smart Typography is active on the current tab.

## Automatic replacements

| Typed sequence | Replacement | Notes |
| --- | --- | --- |
| `'` | `‘` or `’` | Chooses opening/closing form based on context. |
| `"` | `“` or `”` | Tracks nested double quotes to decide when to close. |
| `...` | `…` | Ellipsis, inserted after you finish typing the dots. |
| `--` | `—` | Em dash. |
| `<-` | `←` | Left arrow. |
| `->` | `→` | Right arrow. |
| `<=` | `≤` | Less-than or equal. |
| `>=` | `≥` | Greater-than or equal. |
| `/=` | `≠` | Not equal. |
| `<<` | `«` | Left angle quotes / guillemets. |
| `>>` | `»` | Right angle quotes / guillemets. |

## Fraction support

The content script watches for `number/number` patterns immediately before the caret:

- Built-in glyphs: `1/2 → ½`, `1/3 → ⅓`, `2/3 → ⅔`, `1/4 → ¼`, `3/4 → ¾`, `1/5 → ⅕`, `2/5 → ⅖`, `3/5 → ⅗`, `4/5 → ⅘`, `1/6 → ⅙`, `5/6 → ⅚`, `1/7 → ⅐`, `1/8 → ⅛`, `3/8 → ⅜`, `5/8 → ⅝`, `7/8 → ⅞`, `1/9 → ⅑`, `1/10 → ⅒`.
- All other fractions fall back to stacked numerators and denominators using superscripts and subscripts, such as `11/16 → ¹¹⁄₁₆`.

## Usage

### Installation
1. Download the latest signed `.xpi` from the [Releases](https://github.com/aloglu/smart-typography/releases) page or by clicking [here](https://github.com/aloglu/smart-typography/releases/latest/download/smart.typography.xpi).
2. In Firefox, open `about:addons`, click the gear icon, and choose **Install Add-on From File…**.
3. Select the downloaded package to complete the install (Firefox treats it like any other signed extension, so it will show up under Extensions and auto-update when you grab a new release).

### Popup controls
- **Global switch** toggles Smart Typography everywhere and updates the badge/label immediately.
- **Site switch** overrides just the active origin (handy for CMS editors or online IDEs).
- Status text shows whether the current site is on, forced on, or disabled.
- Use `\` followed by a quote when you need the raw `'` or `"` character—the extension deletes the backslash and lets the next quote through unchanged.

## License

Released under the [MIT License](https://github.com/aloglu/smart-typography/blob/main/LICENSE).

## Acknowledgement

This extension’s icon was created by [Xinh Studio](https://www.flaticon.com/authors/xinh-studio/flat?author_id=1323&type=standard).

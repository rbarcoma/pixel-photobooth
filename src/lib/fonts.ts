// Keep canvas previews and downloads in sync with the CSS font stacks.
export const PIXEL_FONT_FAMILY = '"Arcade Classic", monospace';
export const BODY_FONT_FAMILY = '"DM Sans", sans-serif';

let fontReady: Promise<void> | undefined;
export function loadPixelFont(): Promise<void> {
  return fontReady ??= document.fonts.load('16px "Arcade Classic"')
    .then(() => undefined)
    .catch(() => undefined); // Keep the booth usable if a local font is unavailable.
}

let bodyFontReady: Promise<void> | undefined;
export function loadBodyFont(): Promise<void> {
  return bodyFontReady ??= document.fonts.load('16px "DM Sans"')
    .then(() => undefined)
    .catch(() => undefined);
}

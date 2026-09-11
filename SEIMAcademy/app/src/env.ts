/**
 * Build-time environment, read once and defensively.
 *
 * Vite replaces `import.meta.env` at build time. Under the test runner there is no Vite, so
 * these read through optional chaining and fall back — otherwise a component test that
 * touches content loading would build a URL beginning with the string "undefined" and fail
 * somewhere far from the cause.
 */
export const BASE_URL: string = import.meta.env?.BASE_URL ?? '/';
export const IS_PROD: boolean = import.meta.env?.PROD === true;

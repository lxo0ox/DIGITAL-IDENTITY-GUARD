/*
 * Site settings. Nothing secret belongs here: this file is public.
 *
 * readerUrl: address of the screenshot reader (the Cloudflare Worker in
 * server/, e.g. "https://dig-screenshot-reader.<your-subdomain>.workers.dev").
 * Leave it empty to switch screenshot reading off.
 */
window.DIG_CONFIG = {
  readerUrl: '',
};

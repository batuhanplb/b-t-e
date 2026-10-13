import html from "../original-index.html?raw";

// Serves the original Bütçe index.html byte-for-byte.
export const serveOriginal = () =>
  new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });

import * as DOM from "./dom.js";
import { CHROME_FAVICON_PREFIX, DEFAULT_FAVICON } from "./constants.js";

const URL_WITH_SCHEME_RE = /^[a-z][a-z\d+.-]*:\/\//i;
let faviconAbortController = null;

const resolveChromeFaviconUrl = (pageUrl) =>
  chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=64`);

export const getFaviconUrl = (faviconCache) => {
  if (!faviconCache || faviconCache === DEFAULT_FAVICON) {
    return "icons/icon48.png";
  }

  if (faviconCache.startsWith(CHROME_FAVICON_PREFIX)) {
    return resolveChromeFaviconUrl(faviconCache.slice(CHROME_FAVICON_PREFIX.length));
  }

  return faviconCache;
};

const getUrlInfo = (url) => {
  const normalizedUrl = normalizeUrl(url);
  try {
    const parsed = new URL(normalizedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return {
      normalizedUrl,
      hostname: parsed.hostname,
      origin: parsed.origin,
    };
  } catch (error) {
    console.warn(`Invalid URL: ${url}`, error);
    return null;
  }
};

const waitForImageLoad = (src, signal) =>
  new Promise((resolve, reject) => {
    const image = new Image();

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", abort);
    };

    const abort = () => {
      cleanup();
      reject(new DOMException("Favicon request aborted", "AbortError"));
    };

    image.onload = () => {
      cleanup();
      resolve(src);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error(`Could not load favicon: ${src}`));
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });
    image.referrerPolicy = "no-referrer";
    image.src = src;
  });

export const fetchFavicon = async (url) => {
  abortFaviconFetch();
  faviconAbortController = new AbortController();
  const signal = faviconAbortController.signal;

  DOM.faviconSpinner.classList.remove("d-none");
  DOM.faviconPreview.classList.add("d-none");

  const setFavicon = (faviconCache) => {
    if (!signal.aborted) {
      DOM.faviconPreview.dataset.faviconCache = faviconCache;
      DOM.faviconPreview.src = getFaviconUrl(faviconCache);
      DOM.faviconSpinner.classList.add("d-none");
      DOM.faviconPreview.classList.remove("d-none");
    }
  };

  const urlInfo = getUrlInfo(url);
  if (!urlInfo) {
    console.log("Invalid URL, using default favicon");
    setFavicon(DEFAULT_FAVICON);
    return;
  }

  const candidates = [
    `${urlInfo.origin}/favicon.ico`,
    `${urlInfo.origin}/apple-touch-icon.png`,
    `https://favicone.com/${urlInfo.hostname}?s=64`,
    `${CHROME_FAVICON_PREFIX}${urlInfo.normalizedUrl}`,
  ];

  for (const faviconCache of candidates) {
    try {
      const displayUrl = getFaviconUrl(faviconCache);
      await waitForImageLoad(displayUrl, signal);
      setFavicon(faviconCache);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn("Favicon candidate failed:", faviconCache, error);
    }
  }

  console.log("Using default favicon");
  setFavicon(DEFAULT_FAVICON);
};

export const abortFaviconFetch = () => {
  if (faviconAbortController) {
    faviconAbortController.abort();
    faviconAbortController = null;
  }
};

export const normalizeUrl = (url) => {
  if (typeof url !== "string") return "";

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return "";

  const candidate = URL_WITH_SCHEME_RE.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

  try {
    const parsed = new URL(candidate);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return trimmedUrl.replace(/[\\/]+$/g, "");
    }

    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";

    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }

    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/[\\/]+$/g, "");
    }

    return parsed.toString();
  } catch (error) {
    return trimmedUrl.replace(/[\\/]+$/g, "");
  }
};

export const debounce = (func, wait) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
};

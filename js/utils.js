import { state } from "./state.js";
import * as DOM from "./dom.js";
import { DEFAULT_FAVICON } from "./constants.js";

export const fetchFavicon = async (url) => {
  if (state.faviconAbortController) {
    state.faviconAbortController.abort();
  }
  state.faviconAbortController = new AbortController();
  const signal = state.faviconAbortController.signal;

  DOM.faviconSpinner.classList.remove("d-none");
  DOM.faviconPreview.classList.add("d-none");

  const setFavicon = (base64data) => {
    if (!signal.aborted) {
      DOM.faviconPreview.src = base64data;
      DOM.faviconSpinner.classList.add("d-none");
      DOM.faviconPreview.classList.remove("d-none");
    }
  };

  const convertUrlToBase64 = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl, { signal });
      if (!response.ok) throw new Error(`Response not OK: ${response.status}`);
      const blob = await response.blob();
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw error;
    }
  };

  const getHostname = (url) => {
    try {
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      return new URL(url).hostname; // Extract domain (e.g., google.com)
    } catch (error) {
      console.warn(`Invalid URL: ${url}`, error);
      return null;
    }
  };

  const domain = getHostname(url);
  if (!domain) {
    console.log("Invalid URL, using default favicon");
    setFavicon(DEFAULT_FAVICON);
    return;
  }

  // Use Favicone API
  try {
    console.log(`Attempting Favicone API for domain: ${domain}`);
    const faviconUrl = `https://favicone.com/${domain}?s=64`;
    const base64 = await convertUrlToBase64(faviconUrl);
    setFavicon(base64);
    console.log("Favicone API succeeded");
  } catch (error) {
    if (error.name === "AbortError") return;
    console.warn("Favicone API failed:", error);
    console.log("Using default favicon");
    setFavicon(DEFAULT_FAVICON);
  }
};

export const normalizeUrl = (url) => {
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
};

export const debounce = (func, wait) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
};

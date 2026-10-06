/* lib/store.js
 *
 * Persists the popup's inputs in chrome.storage.local so they survive the
 * popup being closed - until Reset clears them. No DOM, no calculation: it
 * only moves one plain object in and out of storage.
 *
 * Depends on nothing, so popup.js is the only consumer.
 */
(function (global) {
  "use strict";

  const KEY = "pluInputs_v1";
  const KW2_KEY = "kw2Inputs";
  const HPP_FOB_KEY = "hppFobInputs";
  const VISIBILITY_KEY = "panelVisibility";
  const LOG_DRAFT_KEY = "logFormDraft";
  const OPEN_PANEL_KEY = "openPanel";

  function available() {
    // Guarded so popup.html stays openable as a plain file (tests), where
    // chrome.storage does not exist.
    return typeof chrome !== "undefined" && chrome.storage && typeof chrome.storage.local === "object";
  }

  function load(done) {
    if (!available()) {
      done(null);
      return;
    }
    chrome.storage.local.get(KEY, function (items) {
      done(items[KEY] || null);
    });
  }

  function save(state) {
    if (!available()) return;
    const payload = {};
    payload[KEY] = state;
    chrome.storage.local.set(payload);
  }

  function clear() {
    if (!available()) return;
    chrome.storage.local.remove(KEY);
  }

  function loadKW2(done) {
    if (!available()) {
      done(null);
      return;
    }
    chrome.storage.local.get(KW2_KEY, function (items) {
      done(items[KW2_KEY] || null);
    });
  }

  function saveKW2(state) {
    if (!available()) return;
    const payload = {};
    payload[KW2_KEY] = state;
    chrome.storage.local.set(payload);
  }

  function clearKW2() {
    if (!available()) return;
    chrome.storage.local.remove(KW2_KEY);
  }

  function loadHppFob(done) {
    if (!available()) {
      done(null);
      return;
    }
    chrome.storage.local.get(HPP_FOB_KEY, function (items) {
      done(items[HPP_FOB_KEY] || null);
    });
  }

  function saveHppFob(state) {
    if (!available()) return;
    const payload = {};
    payload[HPP_FOB_KEY] = state;
    chrome.storage.local.set(payload);
  }

  function clearHppFob() {
    if (!available()) return;
    chrome.storage.local.remove(HPP_FOB_KEY);
  }

  function loadLogDraft(done) {
    if (!available()) {
      done(null);
      return;
    }
    chrome.storage.local.get(LOG_DRAFT_KEY, function (items) {
      done(items[LOG_DRAFT_KEY] || null);
    });
  }

  function saveLogDraft(state) {
    if (!available()) return;
    const payload = {};
    payload[LOG_DRAFT_KEY] = state;
    chrome.storage.local.set(payload);
  }

  function clearLogDraft() {
    if (!available()) return;
    chrome.storage.local.remove(LOG_DRAFT_KEY);
  }

  function loadVisibility(done) {
    if (!available()) {
      done(null);
      return;
    }
    chrome.storage.local.get(VISIBILITY_KEY, function (items) {
      const state = items[VISIBILITY_KEY];
      if (!state || typeof state !== "object") {
        done(null);
        return;
      }
      done({
        distribution: typeof state.distribution === "boolean" ? state.distribution : true,
        sellingPrice: typeof state.sellingPrice === "boolean" ? state.sellingPrice : true,
        kw2: typeof state.kw2 === "boolean" ? state.kw2 : true,
        hppFob: typeof state.hppFob === "boolean" ? state.hppFob : true,
        activityLog: typeof state.activityLog === "boolean" ? state.activityLog : true,
      });
    });
  }

  function saveVisibility(state) {
    if (!available()) return;
    const payload = {};
    payload[VISIBILITY_KEY] = {
      distribution: !!state.distribution,
      sellingPrice: !!state.sellingPrice,
      kw2: !!state.kw2,
      hppFob: !!state.hppFob,
      activityLog: state.activityLog !== false,
    };
    chrome.storage.local.set(payload);
  }

  /** Which panel body is open. Separate from panelVisibility: that says which
   *  panels participate, this says which one is currently expanded. */
  function loadOpenPanel(done) {
    if (!available()) {
      done(null);
      return;
    }
    chrome.storage.local.get(OPEN_PANEL_KEY, function (items) {
      done(items[OPEN_PANEL_KEY] || null);
    });
  }

  function saveOpenPanel(key) {
    if (!available()) return;
    const payload = {};
    payload[OPEN_PANEL_KEY] = key;
    chrome.storage.local.set(payload);
  }

  global.PLUStore = {
    load: load,
    save: save,
    clear: clear,
    loadKW2: loadKW2,
    saveKW2: saveKW2,
    clearKW2: clearKW2,
    loadHppFob: loadHppFob,
    saveHppFob: saveHppFob,
    clearHppFob: clearHppFob,
    loadLogDraft: loadLogDraft,
    saveLogDraft: saveLogDraft,
    clearLogDraft: clearLogDraft,
    loadVisibility: loadVisibility,
    saveVisibility: saveVisibility,
    loadOpenPanel: loadOpenPanel,
    saveOpenPanel: saveOpenPanel,
  };
})(globalThis);

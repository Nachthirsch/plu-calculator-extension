/* Small retry queue for activity-log entries that are not yet in the file. */
(function (global) {
  "use strict";

  const KEY = "pendingLogEntries";
  const MAX_PENDING = 5;
  function available() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }
  function loadPending(done) {
    if (!available()) { done([]); return; }
    // Remove the pre-file-source cache from older versions. The JSON file is
    // now authoritative; only the bounded retry queue remains here.
    chrome.storage.local.remove("activityLog", function () {
      chrome.storage.local.get(KEY, function (items) {
        done(Array.isArray(items[KEY]) ? items[KEY].slice(0, MAX_PENDING) : []);
      });
    });
  }
  function savePending(entries, done) {
    const limited = (entries || []).slice(-MAX_PENDING);
    if (!available()) { if (done) done(limited); return; }
    const payload = {}; payload[KEY] = limited;
    chrome.storage.local.set(payload, function () { if (done) done(limited); });
  }
  function enqueuePending(entry, done) {
    loadPending(function (entries) {
      const merged = PLULogic.mergeLogEntries(entries, [entry]).slice(0, MAX_PENDING);
      savePending(merged, done);
    });
  }
  function clearPending(done) {
    if (!available()) { if (done) done(); return; }
    chrome.storage.local.remove(KEY, done);
  }
  global.PLULogStore = {
    loadPending: loadPending,
    savePending: savePending,
    enqueuePending: enqueuePending,
    clearPending: clearPending,
    maxPending: MAX_PENDING,
  };
})(globalThis);

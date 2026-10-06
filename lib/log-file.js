/* File System Access and IndexedDB persistence for the selected log file. */
(function (global) {
  "use strict";

  const DB_NAME = "plu-log-db";
  const STORE_NAME = "handles";
  const HANDLE_KEY = "logFileHandle";

  function openDb() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () { request.result.createObjectStore(STORE_NAME); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  function saveHandle(handle) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function getStoredFileHandle() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(HANDLE_KEY);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }
  function verifyOrRequestPermission(handle) {
    return handle.queryPermission({ mode: "readwrite" }).then(function (permission) {
      return permission === "granted" ? permission : handle.requestPermission({ mode: "readwrite" });
    }).then(function (permission) {
      if (permission !== "granted") throw new Error("Izin tulis file belum diberikan.");
      return handle;
    });
  }
  function pickLogFile() {
    return global.showSaveFilePicker({
      suggestedName: "log-aktivitas-artikel.json",
      types: [{ description: "JSON log", accept: { "application/json": [".json"] } }],
    }).then(function (handle) {
      return verifyOrRequestPermission(handle).then(function () {
        return saveHandle(handle).then(function () { return handle; });
      });
    });
  }
  function readLogFile(handle) {
    return handle.getFile().then(function (file) {
      return file.text();
    }).then(function (content) {
      if (!content.trim()) return [];
      try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.warn("Isi file log tidak dapat dibaca sebagai JSON.", error);
        return [];
      }
    });
  }
  function writeLogFile(handle, entries) {
    return handle.createWritable().then(function (writable) {
      return writable.write(JSON.stringify(entries, null, 2)).then(function () { return writable.close(); });
    });
  }
  function appendEntryToFile(newEntry) {
    return getStoredFileHandle().then(function (handle) {
      if (!handle) return { ok: false, reason: "no-file" };
      return verifyOrRequestPermission(handle).then(function () {
        return readLogFile(handle).then(function (entries) {
          const merged = PLULogic.mergeLogEntries(entries, [newEntry]);
          return writeLogFile(handle, merged).then(function () { return { ok: true }; });
        });
      });
    });
  }
  global.PLULogFile = {
    pickLogFile: pickLogFile,
    getStoredFileHandle: getStoredFileHandle,
    verifyOrRequestPermission: verifyOrRequestPermission,
    readLogFile: readLogFile,
    writeLogFile: writeLogFile,
    appendEntryToFile: appendEntryToFile,
  };
})(globalThis);

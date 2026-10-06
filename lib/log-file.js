/* File System Access and IndexedDB persistence for the selected log folder. */
(function (global) {
  "use strict";

  const DB_NAME = "plu-log-db";
  const STORE_NAME = "handles";
  const DIRECTORY_KEY = "logDirectoryHandle";
  const LEGACY_KEY = "logFileHandle";

  function openDb() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () { request.result.createObjectStore(STORE_NAME); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  function getHandle(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }
  function saveHandle(handle) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);
        tx.objectStore(STORE_NAME).delete(LEGACY_KEY);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function getStoredDirectoryHandle() { return getHandle(DIRECTORY_KEY); }
  function hasLegacyFileHandle() { return getHandle(LEGACY_KEY).then(function (handle) { return !!handle; }); }
  function verifyOrRequestPermission(handle, request) {
    const target = handle;
    return target.queryPermission({ mode: "readwrite" }).then(function (permission) {
      return permission === "granted" ? permission : (request ? target.requestPermission({ mode: "readwrite" }) : permission);
    }).then(function (permission) {
      if (permission !== "granted") throw new Error("Izin tulis folder belum diberikan.");
      return target;
    });
  }
  function pickLogDirectory() {
    return global.showDirectoryPicker({ mode: "readwrite" }).then(function (handle) {
      return verifyOrRequestPermission(handle, true).then(function () {
        return saveHandle(handle).then(function () { return handle; });
      });
    });
  }
  function getLogFileHandle(directoryHandle) {
    return directoryHandle.getFileHandle("log.json", { create: true });
  }
  function readLogFile(directoryHandle) {
    return getLogFileHandle(directoryHandle).then(function (handle) { return handle.getFile(); }).then(function (file) {
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
  function writeLogFile(directoryHandle, entries) {
    return getLogFileHandle(directoryHandle).then(function (handle) {
      return handle.createWritable().then(function (writable) {
        return writable.write(JSON.stringify(entries, null, 2)).then(function () { return writable.close(); });
      });
    });
  }
  function appendEntryToFile(newEntry) {
    return getStoredDirectoryHandle().then(function (handle) {
      if (!handle) return { ok: false, reason: "no-directory" };
      return verifyOrRequestPermission(handle, true).then(function () {
        return readLogFile(handle).then(function (entries) {
          return writeLogFile(handle, PLULogic.mergeLogEntries(entries, [newEntry])).then(function () {
            return { ok: true, directoryHandle: handle };
          });
        });
      });
    });
  }
  function saveEntryImage(directoryHandle, fileName, imageBlob) {
    const receivedFileName = String(fileName || "");
    console.assert(!receivedFileName.includes(":"), "Unsanitized image fileName received: " + receivedFileName);
    const sanitizedFileName = PLULogic.sanitizeForFileName(receivedFileName);
    console.debug("Saving image fileName:", {
      receivedFileName: receivedFileName,
      sanitizedFileName: sanitizedFileName,
      finalFileName: sanitizedFileName,
    });
    return directoryHandle.getDirectoryHandle("images", { create: true }).then(function (images) {
      return images.getFileHandle(sanitizedFileName, { create: true });
    }).then(function (handle) {
      return handle.createWritable().then(function (writable) {
        return writable.write(imageBlob).then(function () { return writable.close(); }).then(function () { return sanitizedFileName; });
      });
    });
  }
  function readEntryImage(directoryHandle, fileName) {
    return directoryHandle.getDirectoryHandle("images").then(function (images) {
      return images.getFileHandle(fileName).then(function (handle) { return handle.getFile(); });
    });
  }
  global.PLULogFile = {
    pickLogDirectory: pickLogDirectory,
    getStoredDirectoryHandle: getStoredDirectoryHandle,
    hasLegacyFileHandle: hasLegacyFileHandle,
    verifyOrRequestPermission: function (handle) { return verifyOrRequestPermission(handle, true); },
    queryPermission: function (handle) { return handle.queryPermission({ mode: "readwrite" }); },
    readLogFile: readLogFile,
    writeLogFile: writeLogFile,
    appendEntryToFile: appendEntryToFile,
    saveEntryImage: saveEntryImage,
    readEntryImage: readEntryImage,
  };
})(globalThis);

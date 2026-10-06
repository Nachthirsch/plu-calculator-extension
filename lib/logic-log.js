/* Pure activity-log validation and formatting. */
(function (global) {
  "use strict";

  const ACTIONS = ["Create PLU", "Rubah HPP", "Rubah HJ", "Buat SP"];
  const SP_ACTIONS = ["SP Keseluruhan", "SP (per LOT)", "SP (per Part)"];

  function text(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function extensionForMimeType(mimeType) {
    return String(mimeType || "").toLowerCase() === "image/jpeg" ? "jpg" : "png";
  }

  function sanitizeForFileName(value) {
    return String(value || "").replace(/[^A-Za-z0-9._-]/g, "_");
  }

  function validateLogEntry(formValues) {
    const values = formValues || {};
    const kodeArtikel = text(values.kodeArtikel);
    const jenisAksi = Array.isArray(values.jenisAksi) ? values.jenisAksi.map(text) : [];
    const subAksi = text(values.subAksi);
    if (!kodeArtikel) throw new Error("Kode Artikel wajib diisi.");
    if (!jenisAksi.length || jenisAksi.some(function (action) { return ACTIONS.indexOf(action) === -1; })) {
      throw new Error("Jenis Aksi wajib dipilih.");
    }
    if (jenisAksi.indexOf("Buat SP") !== -1 && SP_ACTIONS.indexOf(subAksi) === -1) {
      throw new Error("Sub Aksi SP wajib dipilih.");
    }
    return {
      kodeArtikel: kodeArtikel,
      jenisAksi: jenisAksi,
      subAksi: jenisAksi.indexOf("Buat SP") !== -1 ? subAksi : null,
      catatan: text(values.catatan),
    };
  }

  function buildLogEntry(formValues, nowIsoString) {
    const parsed = validateLogEntry(formValues);
    const timestampIso = String(nowIsoString);
    const id = timestampIso + "-" + Math.random().toString(36).slice(2, 10);
    const mimeType = formValues && formValues.gambar && text(formValues.gambar.mimeType);
    return {
      id: id,
      timestampIso: timestampIso,
      kodeArtikel: parsed.kodeArtikel,
      jenisAksi: parsed.jenisAksi,
      subAksi: parsed.subAksi,
      catatan: parsed.catatan,
      nilaiPerubahan: {
        hpp: parsed.jenisAksi.indexOf("Rubah HPP") !== -1 ? {
          lama: text(formValues.hppLama),
          baru: text(formValues.hppBaru),
        } : null,
        hj: parsed.jenisAksi.indexOf("Rubah HJ") !== -1 ? {
          lama: text(formValues.hjLama),
          baru: text(formValues.hjBaru),
        } : null,
        umum: parsed.jenisAksi.indexOf("Rubah HPP") === -1 && parsed.jenisAksi.indexOf("Rubah HJ") === -1 ? {
          lama: text(formValues.nilaiLama),
          baru: text(formValues.nilaiBaru),
        } : null,
      },
      gambar: mimeType ? {
        fileName: sanitizeForFileName(id) + "." + extensionForMimeType(mimeType),
        mimeType: mimeType,
      } : null,
    };
  }

  function formatLogEntryAsText(entry, displayTimestamp) {
    const LABEL_WIDTH = 14;
    const separator = "=".repeat(22);
    const hasValue = function (value) {
      return value !== undefined && value !== null && String(value).trim() !== "";
    };
    const hasPairValue = function (pair) {
      return pair && (hasValue(pair.lama) || hasValue(pair.baru));
    };
    const actions = Array.isArray(entry.jenisAksi) ? entry.jenisAksi : (entry.jenisAksi ? [entry.jenisAksi] : []);
    const actionLines = actions.map(function (action) {
      return action === "Buat SP" && entry.subAksi ? action + " - " + entry.subAksi : action;
    }).map(function (action) { return "- " + action; });
    const sections = [[
      "LOG AKTIVITAS ARTIKEL",
      separator,
      "Waktu".padEnd(LABEL_WIDTH) + ": " + displayTimestamp,
      "Kode Artikel".padEnd(LABEL_WIDTH) + ": " + entry.kodeArtikel,
    ].join("\n"), ["Aksi:", actionLines.join("\n")].join("\n")];
    const changes = entry.nilaiPerubahan;
    const changeLines = [];
    if (changes) {
      if (hasPairValue(changes.hpp)) changeLines.push("- HPP: " + (changes.hpp.lama || "-") + " -> " + (changes.hpp.baru || "-"));
      if (hasPairValue(changes.hj)) changeLines.push("- HJ: " + (changes.hj.lama || "-") + " -> " + (changes.hj.baru || "-"));
      if (hasPairValue(changes.umum)) changeLines.push("- Nilai: " + (changes.umum.lama || "-") + " -> " + (changes.umum.baru || "-"));
    } else if (Object.prototype.hasOwnProperty.call(entry, "nilaiLama") || Object.prototype.hasOwnProperty.call(entry, "nilaiBaru")) {
      if (hasValue(entry.nilaiLama) || hasValue(entry.nilaiBaru)) {
        changeLines.push("- Nilai: " + (entry.nilaiLama || "-") + " -> " + (entry.nilaiBaru || "-"));
      }
    }
    if (changeLines.length) sections.push(["Perubahan Nilai:", changeLines.join("\n")].join("\n"));
    if (entry.gambar && entry.gambar.fileName) {
      sections.push("Lampiran: " + entry.gambar.fileName + " (lihat folder images/)");
    }
    if (entry.catatan) sections.push("# Catatan:\n" + entry.catatan);
    sections.push(separator);
    return sections.join("\n\n");
  }

  function mergeLogEntries(existingEntries, newEntries) {
    const byId = {};
    (existingEntries || []).concat(newEntries || []).forEach(function (entry) {
      if (entry && entry.id) byId[entry.id] = entry;
    });
    return Object.keys(byId).map(function (id) {
      return byId[id];
    }).sort(function (a, b) {
      return String(b.timestampIso).localeCompare(String(a.timestampIso));
    });
  }

  function shouldAutoSend(telegramSettings) {
    const settings = telegramSettings || {};
    return settings.autoSendEnabled === true
      && typeof settings.botToken === "string" && settings.botToken.trim() !== ""
      && typeof settings.chatId === "string" && settings.chatId.trim() !== "";
  }

  function addToPendingQueue(queue, entryId) {
    const current = Array.isArray(queue) ? queue.slice() : [];
    if (current.indexOf(entryId) === -1) current.push(entryId);
    return current.slice(-5);
  }

  function removeFromPendingQueue(queue, entryId) {
    return (Array.isArray(queue) ? queue : []).filter(function (id) {
      return id !== entryId;
    });
  }

/** Page window for a list of totalCount rows. Pages are 1-based; start/end
   *  are 0-based slice bounds with end exclusive. An out-of-range page is
   *  clamped instead of returning an empty window, so a stale page number can
   *  never blank the table. An empty list is still one (empty) page, so the UI
   *  never has to render "page 1 of 0". */
  function paginate(totalCount, pageSize, page) {
    const total = Math.max(0, Math.floor(Number(totalCount) || 0));
    const size = Math.max(1, Math.floor(Number(pageSize) || 0));
    const pageCount = Math.max(1, Math.ceil(total / size));

    const wanted = Math.floor(Number(page) || 0);
    const resolved = Math.min(Math.max(1, wanted || 1), pageCount);
    const start = (resolved - 1) * size;
    const hasPrev = resolved > 1;
    const hasNext = resolved < pageCount;

    return {
      page: resolved,
      pageCount: pageCount,
      pageSize: size,
      totalCount: total,
      start: start,
      end: Math.min(start + size, total),
      hasPrev: hasPrev,
      hasNext: hasNext,
      // Compared against the raw request, so page 0 or a page past the end
      // both report as clamped.
      clamped: resolved !== wanted,
    };
  }

  global.PLULogic = {
    validateLogEntry: validateLogEntry,
    buildLogEntry: buildLogEntry,
    formatLogEntryAsText: formatLogEntryAsText,
    mergeLogEntries: mergeLogEntries,
    paginate: paginate,
    shouldAutoSend: shouldAutoSend,
    addToPendingQueue: addToPendingQueue,
    removeFromPendingQueue: removeFromPendingQueue,
    extensionForMimeType: extensionForMimeType,
    sanitizeForFileName: sanitizeForFileName,
  };
})(globalThis);

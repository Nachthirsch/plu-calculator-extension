/* Optional Telegram transport for activity-log entries. */
(function (global) {
  "use strict";

  function sendLogEntryToTelegram(entry, displayTimestamp, settings) {
    const configured = settings || {};
    const token = typeof configured.botToken === "string" ? configured.botToken.trim() : "";
    const chatId = typeof configured.chatId === "string" ? configured.chatId.trim() : "";
    if (!token || !chatId) return Promise.resolve({ ok: false, error: "Bot Token dan Chat ID wajib diisi." });

    let text;
    try {
      text = PLULogic.formatLogEntryAsText(entry, displayTimestamp);
    } catch (error) {
      return Promise.resolve({ ok: false, error: error.message || "Format pesan gagal." });
    }

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;
    return fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text }),
      signal: controller ? controller.signal : undefined,
    }).then(function (response) {
      return response.text().then(function (body) {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (error) {
          throw new Error("Respons Telegram tidak valid.");
        }
        if (!response.ok || !parsed.ok) {
          throw new Error(parsed.description || ("HTTP " + response.status));
        }
        return { ok: true };
      });
    }).catch(function (error) {
      return { ok: false, error: error.message || "Pengiriman Telegram gagal." };
    }).finally(function () {
      if (timeout) clearTimeout(timeout);
    });
  }

  global.sendLogEntryToTelegram = sendLogEntryToTelegram;
})(globalThis);

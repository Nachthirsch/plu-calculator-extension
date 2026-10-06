/* Optional Telegram transport for activity-log entries. */
(function (global) {
  "use strict";

  function settingsParts(settings) {
    const configured = settings || {};
    return {
      token: typeof configured.botToken === "string" ? configured.botToken.trim() : "",
      chatId: typeof configured.chatId === "string" ? configured.chatId.trim() : "",
    };
  }
  function request(method, body, headers) {
    return Promise.resolve().then(function () { return fetch("https://api.telegram.org/bot" + method, {
      method: "POST",
      headers: headers,
      body: body,
    }); }).then(function (response) {
      return response.text().then(function (raw) {
        let parsed;
        try { parsed = JSON.parse(raw); } catch (error) { throw new Error("Respons Telegram tidak valid."); }
        if (!response.ok || !parsed.ok) throw new Error(parsed.description || ("HTTP " + response.status));
        return { ok: true };
      });
    }).catch(function (error) {
      return { ok: false, error: error.message || "Pengiriman Telegram gagal." };
    });
  }
  function sendTextToTelegram(text, settings) {
    const parts = settingsParts(settings);
    if (!parts.token || !parts.chatId) return Promise.resolve({ ok: false, error: "Bot Token dan Chat ID wajib diisi." });
    return request(parts.token + "/sendMessage", JSON.stringify({ chat_id: parts.chatId, text: text }), { "Content-Type": "application/json" });
  }
  function sendPhotoToTelegram(imageBlob, caption, settings) {
    const parts = settingsParts(settings);
    if (!parts.token || !parts.chatId) return Promise.resolve({ ok: false, error: "Bot Token dan Chat ID wajib diisi." });
    if (!imageBlob) return Promise.resolve({ ok: false, error: "Gambar tidak tersedia." });
    try {
      const form = new FormData();
      form.append("chat_id", parts.chatId);
      form.append("photo", imageBlob, "screenshot");
      form.append("caption", caption || "");
      return request(parts.token + "/sendPhoto", form);
    } catch (error) {
      return Promise.resolve({ ok: false, error: error.message || "Pengiriman gambar gagal." });
    }
  }
  global.sendTextToTelegram = sendTextToTelegram;
  global.sendPhotoToTelegram = sendPhotoToTelegram;
})(globalThis);

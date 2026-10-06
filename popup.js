/* popup.js
 *
 * Presentation layer only. It reads the DOM, hands the values to the pure
 * modules in lib/, and renders what they return - no arithmetic of its own,
 * so every number shown here comes from the exact BigInt core.
 */
(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };
  const SIZES = PLUCalc.SIZE_COLUMNS;
  const MODE_AUTO = PLUCalc.MODE_AUTO;
  const MODE_MANUAL = PLUCalc.MODE_MANUAL;

  const els = {
    qty: $("qty"),
    colors: $("colors"),
    mode: $("mode"),
    ratios: { S: $("ratio-S"), M: $("ratio-M"), L: $("ratio-L"), XL: $("ratio-XL"), Z: $("ratio-Z") },
    qcWrap: $("qty-colors"),
    qcGrid: $("qc-grid"),
    calc: $("calculate"),
    reset: $("reset"),
    err: $("plu-error"),
    wrap: $("plu-result-wrap"),
    copy: $("plu-copy"),
    reconcile: $("plu-reconcile"),
    head: $("plu-head"),
    body: $("plu-body"),
    kurs: $("kurs"),
    rmb: $("rmb"),
    priceCalc: $("price-calc"),
    priceReset: $("price-reset"),
    priceErr: $("price-error"),
    priceResult: $("price-result"),
    priceCopy: $("price-copy"),
    priceCopyWrap: $("price-copy-wrap"),
    kw2Hpp: $("kw2-hpp"),
    kw2Calc: $("kw2-calculate"),
    kw2Reset: $("kw2-reset"),
    kw2Err: $("kw2-error"),
    kw2Result: $("kw2-result"),
    kw2Copy: $("kw2-copy"),
    kw2CopyWrap: $("kw2-copy-wrap"),
    kw2OutRaw: $("kw2-out-raw"),
    kw2OutHj: $("kw2-out-hj"),
    kw2OutMargin: $("kw2-out-margin"),
    fobQty: $("fob-qty"),
    fobDiscount: $("fob-discount"),
    fobHpp: $("fob-hpp"),
    fobAccessories: $("fob-accessories"),
    fobCalc: $("fob-calculate"),
    fobReset: $("fob-reset"),
    fobErr: $("fob-error"),
    fobResult: $("fob-result"),
    fobCopy: $("fob-copy"),
    fobCopyWrap: $("fob-copy-wrap"),
    fobOutAfterDisc: $("fob-out-after-disc"),
    fobOutDpp: $("fob-out-dpp"),
    fobOutTotal: $("fob-out-total"),
    fobOutPpn: $("fob-out-ppn"),
    fobOutPlusAks: $("fob-out-plus-aks"),
    distributionPanel: $("distribution-panel"),
    sellingPricePanel: $("selling-price-panel"),
    kw2Panel: $("kw2-panel"),
    fobPanel: $("hpp-fob-panel"),
    activityPanel: $("activity-log-panel"),
    emptyState: $("empty-state"),
    visibilityDistribution: $("visibility-distribution"),
    visibilitySellingPrice: $("visibility-selling-price"),
    visibilityKw2: $("visibility-kw2"),
    visibilityFob: $("visibility-hpp-fob"),
    visibilityActivity: $("visibility-activity-log"),
    activityFileStatus: $("activity-file-status"),
    activityPickFile: $("activity-pick-file"),
    activityPendingWarning: $("activity-pending-warning"),
    activityKode: $("activity-kode"),
    activityActions: document.querySelectorAll('input[name="activity-action"]'),
    activitySubWrap: $("activity-sub-wrap"),
    activitySub: $("activity-sub"),
    activityHppFields: $("activity-hpp-fields"),
    activityHppOld: $("activity-hpp-old"),
    activityHppNew: $("activity-hpp-new"),
    activityHjFields: $("activity-hj-fields"),
    activityHjOld: $("activity-hj-old"),
    activityHjNew: $("activity-hj-new"),
    activityGenericFields: $("activity-generic-fields"),
    activityOld: $("activity-old"),
    activityNew: $("activity-new"),
    activityNote: $("activity-note"),
    activityAdd: $("activity-add"),
    activityReset: $("activity-reset"),
    activityError: $("activity-error"),
    activityFilter: $("activity-filter"),
    activityHistory: $("activity-history"),
    activityEmpty: $("activity-empty"),
    activityPagination: $("activity-pagination"),
    activityPageInfo: $("activity-page-info"),
    activityPageFirst: $("activity-page-first"),
    activityPagePrev: $("activity-page-prev"),
    activityPageNext: $("activity-page-next"),
    activityPageLast: $("activity-page-last"),
    telegramBotToken: $("telegram-bot-token"),
    telegramChatId: $("telegram-chat-id"),
    telegramSave: $("telegram-save"),
    telegramAutoSend: $("telegram-auto-send"),
    telegramSettingsMessage: $("telegram-settings-message"),
    telegramPendingWarning: $("telegram-pending-warning"),
  };

  let panelVisibility = { distribution: true, sellingPrice: true, kw2: true, hppFob: true, activityLog: true };
  let activityEntries = [];
  let pendingActivityEntries = [];
  let activityPermissionNotice = null;
  let telegramSettings = { botToken: "", chatId: "", autoSendEnabled: false };
  let telegramStatuses = {};
  let telegramSettingsLoaded = false;
  let activityEntriesLoaded = false;
  let lastDistributionResult = null;

  /** Copy text and flash the button label, so a click always confirms
   *  whether the paste actually happened. Falls back to a hidden textarea
   *  when the async clipboard API is unavailable or refused. */
  function copyToClipboard(text, button) {
    const original = button.getAttribute("data-label") || button.textContent;
    button.setAttribute("data-label", original);
    const flash = function (label) {
      button.textContent = label;
      button.disabled = true;
      setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    };
    const fallback = function () {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(area);
      flash(ok ? "Tersalin!" : "Gagal menyalin");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          flash("Tersalin!");
        },
        function () {
          fallback();
        },
      );
      return;
    }
    fallback();
  }

  /** Show a message in a panel, or hide it when text is empty. */
  function setMessage(el, text) {
    if (text) {
      el.textContent = text;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function loadTelegramSettings(done) {
      if (!chrome.storage || !chrome.storage.local) { done(); return; }
      chrome.storage.local.get("telegramSettings", function (items) {
        const saved = items.telegramSettings || {};
        telegramSettings = {
          botToken: typeof saved.botToken === "string" ? saved.botToken : "",
          chatId: typeof saved.chatId === "string" ? saved.chatId : "",
          autoSendEnabled: saved.autoSendEnabled === true,
        };
        els.telegramBotToken.value = telegramSettings.botToken;
        els.telegramChatId.value = telegramSettings.chatId;
        els.telegramAutoSend.checked = telegramSettings.autoSendEnabled;
        telegramSettingsLoaded = true;
        done();
      });
    }

  function saveTelegramSettings() {
      const botToken = els.telegramBotToken.value.trim();
      const chatId = els.telegramChatId.value.trim();
      const autoSendEnabled = telegramSettings.autoSendEnabled && !!botToken && !!chatId;
      telegramSettings = { botToken: botToken, chatId: chatId, autoSendEnabled: autoSendEnabled };
      chrome.storage.local.set({ telegramSettings: telegramSettings }, function () {
        els.telegramAutoSend.checked = autoSendEnabled;
        setMessage(els.telegramSettingsMessage, "Pengaturan Telegram tersimpan.");
        if (PLULogic.shouldAutoSend(telegramSettings)) retryPendingTelegramSends();
      });
    }

  function savePendingTelegramQueue(queue, done) {
      chrome.storage.local.set({ pendingTelegramSends: queue }, function () {
        if (done) done(queue);
      });
    }

  function updateTelegramPendingWarning(queue) {
      els.telegramPendingWarning.textContent = "";
      if (!queue.length) {
        els.telegramPendingWarning.hidden = true;
        return;
      }
      els.telegramPendingWarning.hidden = false;
      els.telegramPendingWarning.appendChild(document.createTextNode(queue.length + " log belum terkirim ke Telegram. "));
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Coba Kirim Ulang";
      retry.addEventListener("click", retryPendingTelegramSends);
      els.telegramPendingWarning.appendChild(retry);
    }

  function setTelegramStatus(entryId, message) {
      telegramStatuses[entryId] = message;
      renderActivityHistory();
    }

  function queueTelegramFailure(entry, error) {
      chrome.storage.local.get("pendingTelegramSends", function (items) {
        const queue = PLULogic.addToPendingQueue(items.pendingTelegramSends, entry.id);
        savePendingTelegramQueue(queue, function () {
          updateTelegramPendingWarning(queue);
          setTelegramStatus(entry.id, "Gagal kirim ke Telegram: " + error);
        });
      });
    }

  function sendActivityEntryToTelegram(entry) {
      if (!PLULogic.shouldAutoSend(telegramSettings)) return;
      sendLogEntryToTelegram(entry, displayActivityTime(entry.timestampIso), telegramSettings).then(function (result) {
        if (result.ok) {
          chrome.storage.local.get("pendingTelegramSends", function (items) {
            const queue = PLULogic.removeFromPendingQueue(items.pendingTelegramSends, entry.id);
            savePendingTelegramQueue(queue, function () {
              updateTelegramPendingWarning(queue);
              setTelegramStatus(entry.id, "Terkirim ke Telegram");
            });
          });
        } else {
          queueTelegramFailure(entry, result.error);
        }
      });
    }

  function retryPendingTelegramSends() {
      if (!telegramSettingsLoaded || !PLULogic.shouldAutoSend(telegramSettings)) return;
      chrome.storage.local.get("pendingTelegramSends", function (items) {
        const queue = Array.isArray(items.pendingTelegramSends) ? items.pendingTelegramSends.slice() : [];
        const found = [];
        queue.forEach(function (entryId) {
          const entry = activityEntries.find(function (candidate) { return candidate.id === entryId; });
          if (!entry) {
            console.warn("Log Telegram tertunda tidak ditemukan: " + entryId);
            return;
          }
          found.push(entryId);
          sendActivityEntryToTelegram(entry);
        });
        if (found.length !== queue.length) savePendingTelegramQueue(found, updateTelegramPendingWarning);
        else updateTelegramPendingWarning(queue);
      });
    }

  function panelIsVisible(panel) {
    const panelKeys = {
      distributionPanel: "distribution",
      sellingPricePanel: "sellingPrice",
      kw2Panel: "kw2",
      fobPanel: "hppFob",
      activityPanel: "activityLog",
    };
    return panelVisibility[panelKeys[panel]] === true;
  }

  // ---- accordion -------------------------------------------------------
  // Only one panel body is open at a time. The other visible panels collapse
  // to their one-line header, which reclaims the ~40px of title chrome each
  // panel used to spend before showing a single input. Collapsing never
  // destroys state: inputs live in the DOM and keep their values, so
  // re-opening a panel shows exactly what was typed.
  const PANEL_KEYS = ["distribution", "sellingPrice", "kw2", "hppFob", "activityLog"];
  const SECTION_OF = {
    distribution: "distributionPanel",
    sellingPrice: "sellingPricePanel",
    kw2: "kw2Panel",
    hppFob: "fobPanel",
    activityLog: "activityPanel",
  };
  let openPanel = "distribution";

  // Log table shows 5 rows per page. The page number lives outside storage on
  // purpose: it is view state, not data, and it resets whenever the list
  // underneath it changes shape.
  const ACTIVITY_PAGE_SIZE = 5;
  let activityPage = 1;
  // Page count of the list as last rendered, i.e. after filtering. The "last"
  // button must use this rather than the raw entry count, or it would jump
  // past the end of a filtered list.
  let activityPageCount = 1;

  function panelEls(key) {
    return {
      section: els[SECTION_OF[key]],
      head: $("panel-head-" + key),
      body: $("panel-body-" + key),
    };
  }

  /** Apply open/collapsed state to all five panels without touching which
   *  panels are visible - visibility is the toggle bar's job. */
  function applyAccordion() {
    for (const key of PANEL_KEYS) {
      const pe = panelEls(key);
      if (!pe.section || !pe.head || !pe.body) continue;
      const isOpen = key === openPanel && panelVisibility[key] === true;
      pe.section.classList.toggle("is-collapsed", !isOpen);
      pe.body.hidden = !isOpen;
      pe.head.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function togglePanel(key) {
    if (panelVisibility[key] !== true) return; // hidden panels cannot open
    if (key === openPanel) return; // never leave every panel closed
    openPanel = key;
    applyAccordion();
    PLUStore.saveOpenPanel(openPanel);
    // A panel opened by hand should show its result immediately.
    if (key === "activityLog") loadActivityLog();
    else renderActiveResults();
  }

  function wireAccordion() {
    for (const key of PANEL_KEYS) {
      const pe = panelEls(key);
      if (!pe.head) continue;
      pe.head.addEventListener("click", function () {
        togglePanel(key);
      });
      // role="button" headers must also respond to Enter and Space.
      pe.head.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          togglePanel(key);
        }
      });
    }
  }

  function applyPanelVisibility() {
    els.distributionPanel.hidden = !panelVisibility.distribution;
    els.sellingPricePanel.hidden = !panelVisibility.sellingPrice;
    els.kw2Panel.hidden = !panelVisibility.kw2;
    els.fobPanel.hidden = !panelVisibility.hppFob;
    els.activityPanel.hidden = !panelVisibility.activityLog;
    els.emptyState.hidden = panelVisibility.distribution || panelVisibility.sellingPrice || panelVisibility.kw2 || panelVisibility.hppFob || panelVisibility.activityLog;
    els.visibilityDistribution.checked = panelVisibility.distribution;
    els.visibilitySellingPrice.checked = panelVisibility.sellingPrice;
    els.visibilityKw2.checked = panelVisibility.kw2;
    els.visibilityFob.checked = panelVisibility.hppFob;
    els.visibilityActivity.checked = panelVisibility.activityLog;
    // Hiding the open panel would leave nothing expanded, so promote the
    // first still-visible panel. Showing one never steals the open slot.
    if (panelVisibility[openPanel] !== true) {
      const next = PANEL_KEYS.find(function (key) {
        return panelVisibility[key] === true;
      });
      if (next) openPanel = next;
    }
    applyAccordion();
  }

  function renderActiveResults() {
    if (
      panelIsVisible("distributionPanel") &&
      (els.qty.value ||
        els.colors.value ||
        SIZES.some(function (s) {
          return els.ratios[s].value;
        }))
    ) {
      onCalculate();
    }
    if (panelIsVisible("sellingPricePanel") && els.kurs.value && els.rmb.value) {
      onPriceCalculate();
    }
    if (panelIsVisible("kw2Panel") && els.kw2Hpp.value) {
      onKW2Calculate();
    }
    if (panelIsVisible("fobPanel") && (els.fobQty.value || els.fobDiscount.value || els.fobHpp.value || els.fobAccessories.value)) {
      onHppFobCalculate();
    }
    if (panelIsVisible("activityPanel")) {
      loadActivityLog();
    }
  }

  function updatePanelVisibility() {
    panelVisibility = {
      distribution: els.visibilityDistribution.checked,
      sellingPrice: els.visibilitySellingPrice.checked,
      kw2: els.visibilityKw2.checked,
      hppFob: els.visibilityFob.checked,
      activityLog: els.visibilityActivity.checked,
    };
    applyPanelVisibility();
    PLUStore.saveVisibility(panelVisibility);
    if (panelVisibility.activityLog) loadActivityLog();
  }

  function clearTable() {
    els.head.textContent = "";
    els.body.textContent = "";
    els.reconcile.hidden = true;
    els.reconcile.textContent = "";
    els.wrap.hidden = true;
    lastDistributionResult = null;
  }

  /** Build (or rebuild) one Qty Color input per color, keeping the values the
   *  user already typed. Exactly numColors fields - no more, no fewer. */
  function rebuildQtyColors() {
    const numColors = Number(els.colors.value);
    const manual = els.mode.value === MODE_MANUAL;
    const old = Array.prototype.map.call(els.qcGrid.querySelectorAll("input"), function (i) {
      return i.value;
    });

    els.qcGrid.textContent = "";
    if (!manual || !(Number.isInteger(numColors) && numColors >= 1)) {
      els.qcWrap.hidden = true;
      return null;
    }

    for (let i = 0; i < numColors; i++) {
      const wrap = document.createElement("label");
      wrap.className = "field";
      const label = document.createElement("span");
      label.textContent = "Color " + (i + 1);
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = "0";
      input.value = old[i] || "";
      wrap.appendChild(label);
      wrap.appendChild(input);
      els.qcGrid.appendChild(wrap);
    }
    els.qcWrap.hidden = false;
    return Array.prototype.map.call(els.qcGrid.querySelectorAll("input"), function (i) {
      return i.value;
    });
  }

  function formatPecahanDisplay(value) {
    const fraction = Fraction.from(value);
    if (fraction.isInteger()) return fraction.numerator.toString();

    const scaled = Fraction.roundHalfUp(fraction.mul(100));
    const decimals = scaled % 100n;
    const whole = (scaled - decimals) / 100n;
    if (decimals === 0n) return whole.toString();

    return whole.toString() + "." + decimals.toString().padStart(2, "0").replace(/0+$/, "");
  }

  /** The distribution table: Pecahan row, one row per color, TOTAL row. */
  function renderTable(result) {
    const hasZ = result.pecahan && result.pecahan.Z && !result.pecahan.Z.isZero();
    lastDistributionResult = result;

    // Header: label + S M L XL Z + TOTAL
    els.head.textContent = "";
    appendCell(els.head, "th", "", "row-label");
    for (const size of SIZES) appendCell(els.head, "th", size, size === "Z" ? "z-col" : "");
    appendCell(els.head, "th", "TOTAL", "");

    els.body.textContent = "";

    // Pecahan row - shown exact, like Excel's General format.
    const pecahanRow = document.createElement("tr");
    pecahanRow.className = "pecahan";
    appendCell(pecahanRow, "td", "Pecahan", "row-label");
    for (const size of SIZES) {
      appendCell(pecahanRow, "td", formatPecahanDisplay(result.pecahan[size]), size === "Z" && !hasZ ? "z-col" : "");
    }
    appendCell(pecahanRow, "td", formatPecahanDisplay(result.pecahanTotal), "");
    els.body.appendChild(pecahanRow);

    // One row per color. Z shows "-" when it carries no ratio.
    result.colorRows.forEach(function (row, index) {
      const tr = document.createElement("tr");
      tr.className = "color";
      appendCell(tr, "td", "Color " + (index + 1), "row-label");
      for (const size of SIZES) {
        const isPlaceholder = row[size] === PLUCalc.Z_PLACEHOLDER;
        appendCell(tr, "td", String(row[size]), isPlaceholder ? "placeholder" : size === "Z" && !hasZ ? "z-col" : "");
      }
      appendCell(tr, "td", "", "");
      els.body.appendChild(tr);
    });

    // Totals row: plain column sums + the grand total. Never adjusted.
    const totalRow = document.createElement("tr");
    totalRow.className = "total";
    appendCell(totalRow, "td", "TOTAL", "row-label");
    for (const size of SIZES) {
      const isPlaceholder = result.totals[size] === PLUCalc.Z_PLACEHOLDER;
      appendCell(totalRow, "td", String(result.totals[size]), isPlaceholder ? "placeholder" : size === "Z" && !hasZ ? "z-col" : "");
    }
    appendCell(totalRow, "td", String(result.grandTotal), "");
    els.body.appendChild(totalRow);

    renderReconciliation(result);
    els.wrap.hidden = false;
  }

  /** Auto Average never reconciles by design, so a rounding gap is possible.
   *  Say so explicitly instead of leaving the reader to wonder why TOTAL does
   *  not equal Qty. Purely informational - nothing is adjusted. */
  function renderReconciliation(result) {
    const info = result.reconciliation;
    if (!info || info.matched) {
      els.reconcile.hidden = true;
      els.reconcile.textContent = "";
      return;
    }
    const gap = Math.abs(info.difference);
    els.reconcile.hidden = false;
    els.reconcile.textContent =
      "TOTAL " + PLUFormat.formatNumber(new Fraction(info.actual)) +
      " berbeda dari Qty " + PLUFormat.formatNumber(new Fraction(info.expected)) +
      " (selisih " + PLUFormat.formatNumber(new Fraction(gap)) +
      "). Auto Average tidak melakukan rekonsiliasi otomatis.";
  }

  function appendCell(parent, tag, text, cls) {
    const cell = document.createElement(tag);
    cell.textContent = text;
    if (cls) cell.className = cls;
    parent.appendChild(cell);
    return cell;
  }

  /** Everything the user typed, for chrome.storage.local. Only inputs are
   *  stored - results are recomputed on load, so no cached numbers can ever
   *  drift from the formulas. */
  function collectState() {
    const ratios = {};
    SIZES.forEach(function (s) {
      ratios[s] = els.ratios[s].value;
    });
    const qcInputs = els.qcGrid.querySelectorAll("input");
    const qtyColors = Array.prototype.map.call(qcInputs, function (i) {
      return i.value;
    });
    return {
      qty: els.qty.value,
      colors: els.colors.value,
      mode: els.mode.value,
      ratios: ratios,
      qtyColors: qtyColors,
      kurs: els.kurs.value,
      rmb: els.rmb.value,
    };
  }

  let saveTimer = null;
  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      PLUStore.save(collectState());
    }, 250);
  }

  function applyState(state) {
    if (!state) return false;
    els.qty.value = state.qty || "";
    els.colors.value = state.colors || "";
    els.mode.value = state.mode === MODE_MANUAL ? MODE_MANUAL : MODE_AUTO;
    SIZES.forEach(function (s) {
      els.ratios[s].value = (state.ratios && state.ratios[s]) || "";
    });
    els.kurs.value = state.kurs || "";
    els.rmb.value = state.rmb || "";

    // Rebuild the manual fields from the stored color count first, then put
    // their values back, so nothing typed in Manual mode is lost either.
    const qc = state.mode === MODE_MANUAL ? rebuildQtyColors() : null;
    const qcFields = qc && Array.prototype.slice.call(els.qcGrid.querySelectorAll("input"));
    if (qcFields && Array.isArray(state.qtyColors)) {
      state.qtyColors.forEach(function (v, i) {
        const field = qcFields[i];
        if (!field || typeof field !== "object" || !("value" in field)) return;
        field.value = typeof v === "string" ? v : "";
      });
    }
    return true;
  }

  function onCalculate() {
    if (!panelIsVisible("distributionPanel")) return;
    const ratioTexts = SIZES.map(function (s) {
      return els.ratios[s].value;
    });
    let parsed;
    try {
      parsed = PLUValidate.parseInputs(els.qty.value, ratioTexts, els.colors.value);
    } catch (err) {
      setMessage(els.err, err.message);
      if (els.mode.value === MODE_MANUAL) rebuildQtyColors();
      return; // invalid input leaves the previous table untouched
    }

    let result;
    if (els.mode.value === MODE_MANUAL) {
      const texts = rebuildQtyColors() || [];
      try {
        const qtyColors = PLUValidate.parseQtyColorInputs(texts, parsed.qty);
        result = PLUCalc.computeManualDistribution(parsed.qty, parsed.ratios, parsed.numColors, qtyColors);
      } catch (err) {
        setMessage(els.err, err.message);
        return;
      }
    } else {
      result = PLUCalc.computeDistribution(parsed.qty, parsed.ratios, parsed.numColors);
    }

    setMessage(els.err, "");
    renderTable(result);
    saveState();
  }

  function onPriceCalculate() {
    if (!panelIsVisible("sellingPricePanel")) return;
    let kurs, rmb;
    try {
      kurs = PLUValidate.parsePriceInput(els.kurs.value, "Exchange Rate");
      rmb = PLUValidate.parsePriceInput(els.rmb.value, "RMB Amount");
    } catch (err) {
      setMessage(els.priceErr, err.message);
      return; // invalid input leaves the previous result untouched
    }

    const r = PLUCalc.computeSellingPrice(kurs, rmb);
    setMessage(els.priceErr, "");
    $("out-hpp").textContent = PLUFormat.formatRupiahExact(r.hppIdr);
    $("out-n1low").textContent = PLUFormat.formatRupiahExact(r.n1Low);
    $("out-n1high").textContent = PLUFormat.formatRupiahExact(r.n1High);
    $("out-n1").textContent = PLUFormat.formatRupiahExact(r.n1);
    $("out-n1margin").textContent = PLUFormat.formatPercent(r.n1Margin);
    $("out-addon").textContent = PLUFormat.formatRupiahExact(PLUCalc.PRICE_ADDON);
    $("out-hj").textContent = PLUFormat.formatRupiahExact(r.hj);
    $("out-hjmargin").textContent = PLUFormat.formatPercent(r.hjMargin);
    els.priceResult.hidden = false;
    els.priceCopyWrap.hidden = false;
    saveState();
  }

  /** Label/value pairs for the Harga Jual panel, read back out of the DOM so
   *  the clipboard can never disagree with what is on screen. */
  function collectPriceLines() {
    return Array.prototype.map.call(els.priceResult.querySelectorAll("div"), function (row) {
      return [row.querySelector("dt").textContent, row.querySelector("dd").textContent];
    });
  }

  function collectFobLines() {
    return Array.prototype.map.call(els.fobResult.querySelectorAll("div"), function (row) {
      return [row.querySelector("dt").textContent, row.querySelector("dd").textContent];
    });
  }

  function onReset() {
    if (!panelIsVisible("distributionPanel")) return;
    PLUStore.clear();
    els.qty.value = "";
    els.colors.value = "";
    els.mode.value = MODE_AUTO;
    SIZES.forEach(function (s) {
      els.ratios[s].value = "";
    });
    els.qcGrid.textContent = "";
    els.qcWrap.hidden = true;
    setMessage(els.err, "");
    clearTable();
    els.qty.focus();
  }

  function onPriceReset() {
    if (!panelIsVisible("sellingPricePanel")) return;
    PLUStore.clear();
    els.kurs.value = "";
    els.rmb.value = "";
    setMessage(els.priceErr, "");
    els.priceResult.hidden = true;
    els.priceCopyWrap.hidden = true;
    els.kurs.focus();
  }

  function collectKW2State() {
    return { hpp: els.kw2Hpp.value };
  }

  let kw2SaveTimer = null;
  function saveKW2State() {
    if (kw2SaveTimer) clearTimeout(kw2SaveTimer);
    kw2SaveTimer = setTimeout(function () {
      PLUStore.saveKW2(collectKW2State());
    }, 250);
  }

  function onKW2Calculate() {
    if (!panelIsVisible("kw2Panel")) return;
    let parsed;
    try {
      parsed = PLUValidate.parseKW2Input(els.kw2Hpp.value);
    } catch (err) {
      setMessage(els.kw2Err, err.message);
      return; // invalid input leaves the previous KW2 result untouched
    }

    const result = PLUCalc.computeKW2SellingPrice(parsed);
    setMessage(els.kw2Err, "");
    els.kw2OutRaw.textContent = PLUFormat.formatRupiahExact(result.hjKw2Raw);
    els.kw2OutHj.textContent = PLUFormat.formatRupiahExact(result.hjKw2);
    els.kw2OutMargin.textContent = PLUFormat.formatPercent(result.margin);
    els.kw2Result.hidden = false;
    els.kw2CopyWrap.hidden = false;
    saveKW2State();
  }

  function onKW2Reset() {
    if (!panelIsVisible("kw2Panel")) return;
    if (kw2SaveTimer) {
      clearTimeout(kw2SaveTimer);
      kw2SaveTimer = null;
    }
    PLUStore.clearKW2();
    els.kw2Hpp.value = "";
    setMessage(els.kw2Err, "");
    els.kw2Result.hidden = true;
    els.kw2CopyWrap.hidden = true;
    els.kw2Hpp.focus();
  }

  function applyKW2State(state) {
    if (!state || typeof state !== "object" || typeof state.hpp !== "string") {
      els.kw2Hpp.value = "";
      setMessage(els.kw2Err, "");
      els.kw2Result.hidden = true;
      return false;
    }
    if (state.hpp) {
      try {
        PLUValidate.parseKW2Input(state.hpp);
      } catch (err) {
        els.kw2Hpp.value = "";
        setMessage(els.kw2Err, "");
        els.kw2Result.hidden = true;
        return false;
      }
    }
    els.kw2Hpp.value = state.hpp;
    return true;
  }

  function collectHppFobState() {
    return {
      qty: els.fobQty.value,
      discount: els.fobDiscount.value,
      hpp: els.fobHpp.value,
      accessories: els.fobAccessories.value,
    };
  }

  let fobSaveTimer = null;
  function saveHppFobState() {
    if (fobSaveTimer) clearTimeout(fobSaveTimer);
    fobSaveTimer = setTimeout(function () {
      PLUStore.saveHppFob(collectHppFobState());
    }, 250);
  }

  function onHppFobCalculate() {
    if (!panelIsVisible("fobPanel")) return;
    let parsed;
    try {
      parsed = PLUValidate.validateHppFobInput(els.fobQty.value, els.fobDiscount.value, els.fobHpp.value, els.fobAccessories.value);
    } catch (err) {
      setMessage(els.fobErr, err.message);
      return;
    }

    const result = PLUCalc.computeHppFob(parsed.hppAwal, parsed.discPercent, parsed.qtyTotal, parsed.aksesoris);
    setMessage(els.fobErr, "");
    els.fobOutAfterDisc.textContent = PLUFormat.formatRupiahExact(result.hppAfterDisc);
    els.fobOutDpp.textContent = PLUFormat.formatRupiahExact(result.dpp);
    els.fobOutTotal.textContent = PLUFormat.formatRupiahExact(result.total);
    els.fobOutPpn.textContent = PLUFormat.formatRupiahExact(result.ppn);
    els.fobOutPlusAks.textContent = PLUFormat.formatRupiahRounded(result.hppPlusAks);
    els.fobResult.hidden = false;
    els.fobCopyWrap.hidden = false;
    saveHppFobState();
  }

  function onHppFobReset() {
    if (!panelIsVisible("fobPanel")) return;
    if (fobSaveTimer) {
      clearTimeout(fobSaveTimer);
      fobSaveTimer = null;
    }
    PLUStore.clearHppFob();
    els.fobQty.value = "";
    els.fobDiscount.value = "";
    els.fobHpp.value = "";
    els.fobAccessories.value = "";
    setMessage(els.fobErr, "");
    els.fobResult.hidden = true;
    els.fobCopyWrap.hidden = true;
    els.fobQty.focus();
  }

  function applyHppFobState(state) {
    if (!state || typeof state !== "object" || typeof state.qty !== "string" || typeof state.discount !== "string" || typeof state.hpp !== "string" || typeof state.accessories !== "string") {
      els.fobQty.value = "";
      els.fobDiscount.value = "";
      els.fobHpp.value = "";
      els.fobAccessories.value = "";
      setMessage(els.fobErr, "");
      els.fobResult.hidden = true;
      return false;
    }
    els.fobQty.value = state.qty;
    els.fobDiscount.value = state.discount;
    els.fobHpp.value = state.hpp;
    els.fobAccessories.value = state.accessories;
    return true;
  }

  function setActivityError(text) {
    setMessage(els.activityError, text);
  }

  function setActivityPermissionNotice(handle) {
    if (!activityPermissionNotice) {
      activityPermissionNotice = document.createElement("div");
      activityPermissionNotice.className = "activity-warning";
      activityPermissionNotice.hidden = true;
      const fileBar = els.activityFileStatus.parentNode;
      fileBar.parentNode.insertBefore(activityPermissionNotice, fileBar.nextSibling);
    }
    activityPermissionNotice.textContent = "";
    if (!handle) {
      activityPermissionNotice.hidden = true;
      return;
    }
    activityPermissionNotice.hidden = false;
    activityPermissionNotice.appendChild(document.createTextNode("Klik untuk memuat data log tersimpan. "));
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "Muat Data Log";
    loadButton.addEventListener("click", function () {
      PLULogFile.verifyOrRequestPermission(handle).then(function () {
        els.activityFileStatus.textContent = "File log: terhubung";
        setActivityPermissionNotice(null);
        setActivityError("");
        return reloadActivityFromFile(handle);
      }).catch(function (error) {
        setActivityError("Tidak dapat membaca file log: " + error.message);
        renderActivityHistory();
      });
    });
    activityPermissionNotice.appendChild(loadButton);
  }

  function updateActivityWarning() {
    els.activityPendingWarning.textContent = "";
    if (!pendingActivityEntries.length) {
      els.activityPendingWarning.hidden = true;
      return;
    }
    els.activityPendingWarning.hidden = false;
    els.activityPendingWarning.appendChild(document.createTextNode(
      pendingActivityEntries.length + " entri belum tersimpan ke file. ",
    ));
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Coba Simpan Lagi";
    retry.addEventListener("click", flushPendingActivity);
    els.activityPendingWarning.appendChild(retry);
  }

  function displayActivityTime(iso) {
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function getSelectedActivityActions() {
    return Array.prototype.filter.call(els.activityActions, function (input) {
      return input.checked;
    }).map(function (input) {
      return input.value;
    });
  }

  function formatActivityActions(entry) {
    const actions = Array.isArray(entry.jenisAksi) ? entry.jenisAksi : (entry.jenisAksi ? [entry.jenisAksi] : []);
    return actions.map(function (action) {
      return action === "Buat SP" && entry.subAksi ? action + " - " + entry.subAksi : action;
    }).join(", ");
  }

  function formatActivityChanges(entry) {
    if (entry.nilaiPerubahan) {
      const lines = [];
      if (entry.nilaiPerubahan.hpp) lines.push("HPP: " + (entry.nilaiPerubahan.hpp.lama || "-") + " -> " + (entry.nilaiPerubahan.hpp.baru || "-"));
      if (entry.nilaiPerubahan.hj) lines.push("HJ: " + (entry.nilaiPerubahan.hj.lama || "-") + " -> " + (entry.nilaiPerubahan.hj.baru || "-"));
      if (entry.nilaiPerubahan.umum) lines.push("Nilai: " + (entry.nilaiPerubahan.umum.lama || "-") + " -> " + (entry.nilaiPerubahan.umum.baru || "-"));
      return lines.join("\n");
    }
    if (Object.prototype.hasOwnProperty.call(entry, "nilaiLama") || Object.prototype.hasOwnProperty.call(entry, "nilaiBaru")) {
      return (entry.nilaiLama || "-") + " -> " + (entry.nilaiBaru || "-");
    }
    return "";
  }

  function updateActivitySubAction() {
    const isSp = Array.prototype.some.call(els.activityActions, function (input) {
      return input.checked && input.value === "Buat SP";
    });
    els.activitySubWrap.hidden = !isSp;
    els.activitySub.required = isSp;
    if (!isSp) els.activitySub.value = "";
    const hasHpp = Array.prototype.some.call(els.activityActions, function (input) { return input.checked && input.value === "Rubah HPP"; });
    const hasHj = Array.prototype.some.call(els.activityActions, function (input) { return input.checked && input.value === "Rubah HJ"; });
    els.activityHppFields.hidden = !hasHpp;
    els.activityHjFields.hidden = !hasHj;
    els.activityGenericFields.hidden = hasHpp || hasHj;
  }

  function collectActivityDraft() {
    return {
      kodeArtikel: els.activityKode.value,
      jenisAksi: getSelectedActivityActions(),
      subAksi: els.activitySub.value,
      hppLama: els.activityHppOld.value,
      hppBaru: els.activityHppNew.value,
      hjLama: els.activityHjOld.value,
      hjBaru: els.activityHjNew.value,
      nilaiLama: els.activityOld.value,
      nilaiBaru: els.activityNew.value,
      catatan: els.activityNote.value,
    };
  }

  let activityDraftSaveTimer = null;
  function saveActivityDraft() {
    if (activityDraftSaveTimer) clearTimeout(activityDraftSaveTimer);
    activityDraftSaveTimer = setTimeout(function () {
      PLUStore.saveLogDraft(collectActivityDraft());
    }, 250);
  }

  function applyActivityDraft(draft) {
    if (!draft || typeof draft !== "object") return;
    els.activityKode.value = typeof draft.kodeArtikel === "string" ? draft.kodeArtikel : "";
    Array.prototype.forEach.call(els.activityActions, function (input) {
      input.checked = Array.isArray(draft.jenisAksi) && draft.jenisAksi.indexOf(input.value) !== -1;
    });
    els.activitySub.value = typeof draft.subAksi === "string" ? draft.subAksi : "";
    els.activityHppOld.value = typeof draft.hppLama === "string" ? draft.hppLama : "";
    els.activityHppNew.value = typeof draft.hppBaru === "string" ? draft.hppBaru : "";
    els.activityHjOld.value = typeof draft.hjLama === "string" ? draft.hjLama : "";
    els.activityHjNew.value = typeof draft.hjBaru === "string" ? draft.hjBaru : "";
    els.activityOld.value = typeof draft.nilaiLama === "string" ? draft.nilaiLama : "";
    els.activityNew.value = typeof draft.nilaiBaru === "string" ? draft.nilaiBaru : "";
    els.activityNote.value = typeof draft.catatan === "string" ? draft.catatan : "";
    updateActivitySubAction();
  }

  function clearActivityDraft() {
    if (activityDraftSaveTimer) {
      clearTimeout(activityDraftSaveTimer);
      activityDraftSaveTimer = null;
    }
    PLUStore.clearLogDraft();
  }

  function renderActivityHistory() {
    const filter = els.activityFilter.value.trim().toLowerCase();
    els.activityHistory.textContent = "";
    const filtered = activityEntries.filter(function (entry) {
      return !filter || String(entry.kodeArtikel).toLowerCase().indexOf(filter) !== -1;
    });

    // paginate() clamps, so a page number left over from a longer list can
    // never render an empty table.
    const view = PLULogic.paginate(filtered.length, ACTIVITY_PAGE_SIZE, activityPage);
    activityPage = view.page;

    els.activityEmpty.hidden = filtered.length !== 0;
    filtered.slice(view.start, view.end).forEach(function (entry) {
      const row = document.createElement("tr");
      const actionCell = document.createElement("td");
      [
        actionCell,
        displayActivityTime(entry.timestampIso),
        entry.kodeArtikel,
        formatActivityActions(entry),
        formatActivityChanges(entry),
        entry.catatan || "-",
      ].forEach(function (value) {
        if (value === actionCell) row.appendChild(value);
        else appendCell(row, "td", value, "");
      });
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Salin Teks";
      copy.addEventListener("click", function () {
        try {
          navigator.clipboard.writeText(PLULogic.formatLogEntryAsText(entry, displayActivityTime(entry.timestampIso))).then(function () {
            copy.textContent = "Tersalin!";
            setTimeout(function () { copy.textContent = "Salin Teks"; }, 1500);
          }).catch(function () {
            copy.textContent = "Gagal menyalin";
            setTimeout(function () { copy.textContent = "Salin Teks"; }, 1500);
          });
        } catch (error) {
          copy.textContent = "Gagal menyalin";
          setTimeout(function () { copy.textContent = "Salin Teks"; }, 1500);
        }
      });
      actionCell.appendChild(copy);
      if (telegramStatuses[entry.id]) {
        const status = document.createElement("span");
        status.className = "telegram-status";
        status.textContent = telegramStatuses[entry.id];
        actionCell.appendChild(status);
      }
      els.activityHistory.appendChild(row);
    });
    renderActivityPagination(view, filtered.length);
    updateActivityWarning();
    chrome.storage.local.get("pendingTelegramSends", function (items) {
      updateTelegramPendingWarning(Array.isArray(items.pendingTelegramSends) ? items.pendingTelegramSends : []);
    });
  }

  /** Page bar state. Hidden entirely when there is nothing to page through;
   *  first/last/prev/next disable at the edges rather than disappearing, so
   *  the control does not shift sideways as you move between pages. */
  function renderActivityPagination(view, total) {
    activityPageCount = view.pageCount;
    const show = total > 0;
    els.activityPagination.hidden = !show;
    if (!show) {
      els.activityPageInfo.textContent = "";
      return;
    }
    const from = total === 0 ? 0 : view.start + 1;
    const to = view.end;
    els.activityPageInfo.textContent = from + "-" + to + " dari " + total + "  ·  Halaman " + view.page + " / " + view.pageCount;
    els.activityPageFirst.disabled = !view.hasPrev;
    els.activityPagePrev.disabled = !view.hasPrev;
    els.activityPageNext.disabled = !view.hasNext;
    els.activityPageLast.disabled = !view.hasNext;
  }

  /** Jump to a page and re-render. Out-of-range requests are clamped by
   *  paginate(), so this never has to validate the number itself. */
  function goToActivityPage(page) {
    activityPage = page;
    renderActivityHistory();
  }

  function reloadActivityFromFile(handle) {
    return PLULogFile.readLogFile(handle).then(function (entries) {
      activityEntries = PLULogic.mergeLogEntries(entries, pendingActivityEntries);
      activityEntriesLoaded = true;
      renderActivityHistory();
      retryPendingTelegramSends();
      return activityEntries;
    });
  }

  function loadActivityLog() {
    if (!panelIsVisible("activityPanel")) return;
    activityEntries = [];
    renderActivityHistory();
    PLULogStore.loadPending(function (pending) {
      pendingActivityEntries = pending;
      PLULogFile.getStoredFileHandle().then(function (handle) {
        if (!handle) {
          setActivityPermissionNotice(null);
          activityEntries = PLULogic.mergeLogEntries([], pendingActivityEntries);
          activityEntriesLoaded = true;
          els.activityFileStatus.textContent = "File log: belum dipilih";
          setActivityError("");
          renderActivityHistory();
          retryPendingTelegramSends();
          return;
        }
        return handle.queryPermission({ mode: "readwrite" }).then(function (permission) {
          if (permission === "granted") {
            setActivityPermissionNotice(null);
            els.activityFileStatus.textContent = "File log: terhubung";
            setActivityError("");
            return reloadActivityFromFile(handle);
          }
          if (permission === "prompt") {
            els.activityFileStatus.textContent = "File log: izin diperlukan";
            setActivityError("");
            setActivityPermissionNotice(handle);
            activityEntries = PLULogic.mergeLogEntries([], pendingActivityEntries);
            activityEntriesLoaded = true;
            renderActivityHistory();
            retryPendingTelegramSends();
            return;
          }
          setActivityPermissionNotice(null);
          els.activityFileStatus.textContent = "File log: belum dipilih";
          setActivityError("");
          activityEntries = PLULogic.mergeLogEntries([], pendingActivityEntries);
          activityEntriesLoaded = true;
          renderActivityHistory();
          retryPendingTelegramSends();
        });
      }).catch(function (error) {
        setActivityPermissionNotice(null);
        activityEntries = PLULogic.mergeLogEntries([], pendingActivityEntries);
        activityEntriesLoaded = true;
        els.activityFileStatus.textContent = "File log: izin diperlukan";
        setActivityError("Tidak dapat membaca file log: " + error.message);
        renderActivityHistory();
      });
    });
  }

  function clearActivityForm() {
    els.activityKode.value = "";
    Array.prototype.forEach.call(els.activityActions, function (input) { input.checked = false; });
    els.activitySub.value = "";
    els.activityHppOld.value = "";
    els.activityHppNew.value = "";
    els.activityHjOld.value = "";
    els.activityHjNew.value = "";
    els.activitySubWrap.hidden = true;
    els.activitySub.required = false;
    els.activityOld.value = "";
    els.activityNew.value = "";
    els.activityNote.value = "";
    updateActivitySubAction();
    clearActivityDraft();
  }

  function flushPendingActivity(onSuccess) {
    if (!pendingActivityEntries.length) return;
    PLULogFile.getStoredFileHandle().then(function (handle) {
      if (!handle) throw new Error("Pilih file log terlebih dahulu.");
      return PLULogFile.verifyOrRequestPermission(handle).then(function () {
        return PLULogFile.readLogFile(handle).then(function (fileEntries) {
          const merged = PLULogic.mergeLogEntries(fileEntries, pendingActivityEntries);
          return PLULogFile.writeLogFile(handle, merged).then(function () {
            return PLULogStore.clearPending(function () {
              pendingActivityEntries = [];
              activityEntries = merged;
              els.activityFileStatus.textContent = "File log: terhubung";
              setActivityError("");
              renderActivityHistory();
              if (onSuccess) onSuccess();
            });
          });
        });
      });
    }).catch(function (error) {
      setActivityError("Gagal menyimpan ke file log: " + error.message);
      renderActivityHistory();
    });
  }

  function onActivityPickFile() {
    PLULogFile.pickLogFile().then(function (handle) {
      return PLULogFile.verifyOrRequestPermission(handle).then(function () {
        return PLULogFile.readLogFile(handle).then(function (fileEntries) {
          // Show the selected file's existing contents before any pending
          // safeguard entries are flushed back to it.
          activityEntries = PLULogic.mergeLogEntries(fileEntries, []);
          els.activityFileStatus.textContent = "File log: terhubung";
          setActivityPermissionNotice(null);
          setActivityError("");
          renderActivityHistory();
          return new Promise(function (resolve, reject) {
            PLULogStore.loadPending(function (pending) {
              pendingActivityEntries = pending;
              if (!pending.length) {
                resolve();
                return;
              }
              const merged = PLULogic.mergeLogEntries(fileEntries, pending);
              PLULogFile.writeLogFile(handle, merged).then(function () {
                PLULogStore.clearPending(function () {
                  pendingActivityEntries = [];
                  activityEntries = merged;
                  renderActivityHistory();
                  resolve();
                });
              }).catch(reject);
            });
          });
        });
      });
    }).catch(function (error) {
      setActivityError("Gagal memilih atau menyimpan file log: " + error.message);
    });
  }

  function onActivityAdd() {
    let entry;
    try {
      entry = PLULogic.buildLogEntry({
        kodeArtikel: els.activityKode.value,
        jenisAksi: getSelectedActivityActions(),
        subAksi: els.activitySub.value,
        hppLama: els.activityHppOld.value,
        hppBaru: els.activityHppNew.value,
        hjLama: els.activityHjOld.value,
        hjBaru: els.activityHjNew.value,
        catatan: els.activityNote.value,
        nilaiLama: els.activityOld.value,
        nilaiBaru: els.activityNew.value,
      }, new Date().toISOString());
    } catch (error) {
      setActivityError(error.message);
      return;
    }
    setActivityError("");
    // A new entry belongs at the top of a newest-first list, so jump back to
    // page 1 rather than leaving the user on a page that shifted underneath.
    activityPage = 1;
    const sendAfterSave = function () {
      sendActivityEntryToTelegram(entry);
    };
    const save = pendingActivityEntries.length ? (PLULogStore.enqueuePending(entry, function () {
      PLULogStore.loadPending(function (pending) {
        pendingActivityEntries = pending;
        activityEntries = PLULogic.mergeLogEntries(activityEntries, [entry]);
        renderActivityHistory();
        flushPendingActivity(function () {
          clearActivityForm();
          sendAfterSave();
        });
      });
    })) : PLULogFile.appendEntryToFile(entry).then(function (result) {
      if (!result.ok) throw new Error(result.reason === "no-file" ? "Pilih file log terlebih dahulu." : "File log tidak dapat ditulis.");
      return PLULogFile.getStoredFileHandle().then(reloadActivityFromFile);
    });
    if (save && typeof save.catch === "function") {
      save.catch(function (error) {
        PLULogStore.enqueuePending(entry, function () {
          PLULogStore.loadPending(function (pending) {
            pendingActivityEntries = pending;
            activityEntries = PLULogic.mergeLogEntries(activityEntries, [entry]);
            renderActivityHistory();
            setActivityError("Log belum tersimpan ke file: " + error.message);
          });
        });
      });
    }
    if (pendingActivityEntries.length) return;
    save.then(function () {
      clearActivityForm();
      sendAfterSave();
    }).catch(function () {});
  }

  // ---- copy buttons --------------------------------------------------
  els.copy.addEventListener("click", function () {
    if (!lastDistributionResult) return;
    copyToClipboard(PLUFormat.toDistributionTsv(lastDistributionResult), els.copy);
  });
  els.priceCopy.addEventListener("click", function () {
    copyToClipboard(PLUFormat.toResultLines(collectPriceLines()), els.priceCopy);
  });
  els.kw2Copy.addEventListener("click", function () {
    const pairs = [
      ["HJ KW2 Raw (Rp)", els.kw2OutRaw.textContent],
      ["HJ KW2 (Rp)", els.kw2OutHj.textContent],
      ["Margin HJ KW2", els.kw2OutMargin.textContent],
    ];
    copyToClipboard(PLUFormat.toResultLines(pairs), els.kw2Copy);
  });
  els.fobCopy.addEventListener("click", function () {
    copyToClipboard(PLUFormat.toResultLines(collectFobLines()), els.fobCopy);
  });

  // ---- live calculation ---------------------------------------------
  // Each panel recalculates on a debounce while typing, so results track the
  // inputs without a click. Invalid intermediate text just leaves the last
  // good result in place and shows the message, exactly as before.
  const LIVE_DELAY = 300;
  const liveTimers = {};

  function scheduleLive(panel, handler) {
    if (liveTimers[panel]) clearTimeout(liveTimers[panel]);
    liveTimers[panel] = setTimeout(function () {
      liveTimers[panel] = null;
      handler();
    }, LIVE_DELAY);
  }

  function clearLive(panel) {
    if (liveTimers[panel]) {
      clearTimeout(liveTimers[panel]);
      liveTimers[panel] = null;
    }
  }

  function onPluInput() {
    // The manual color fields are rebuilt by the handlers themselves, so only
    // the panel-level inputs drive the debounce here.
    scheduleLive("distribution", onCalculate);
  }

  [els.qty, els.colors].concat(
    SIZES.map(function (s) {
      return els.ratios[s];
    }),
  ).forEach(function (input) {
    input.addEventListener("input", onPluInput);
  });
  els.qcGrid.addEventListener("input", function () {
    scheduleLive("distribution", onCalculate);
  });
  [els.kurs, els.rmb].forEach(function (input) {
    input.addEventListener("input", function () {
      scheduleLive("sellingPrice", onPriceCalculate);
    });
  });
  els.kw2Hpp.addEventListener("input", function () {
    scheduleLive("kw2", onKW2Calculate);
  });
  [els.fobQty, els.fobDiscount, els.fobHpp, els.fobAccessories].forEach(function (input) {
    input.addEventListener("input", function () {
      scheduleLive("hppFob", onHppFobCalculate);
    });
  });

  els.calc.addEventListener("click", function () {
    clearLive("distribution");
    onCalculate();
  });
  els.reset.addEventListener("click", function () {
    clearLive("distribution");
    onReset();
  });
  els.priceCalc.addEventListener("click", function () {
    clearLive("sellingPrice");
    onPriceCalculate();
  });
  els.priceReset.addEventListener("click", function () {
    clearLive("sellingPrice");
    onPriceReset();
  });
  els.kw2Calc.addEventListener("click", function () {
    clearLive("kw2");
    onKW2Calculate();
  });
  els.kw2Reset.addEventListener("click", function () {
    clearLive("kw2");
    onKW2Reset();
  });
  els.fobCalc.addEventListener("click", function () {
    clearLive("hppFob");
    onHppFobCalculate();
  });
  els.fobReset.addEventListener("click", function () {
    clearLive("hppFob");
    onHppFobReset();
  });
  Array.prototype.forEach.call(els.activityActions, function (input) {
    input.addEventListener("change", updateActivitySubAction);
    input.addEventListener("change", saveActivityDraft);
  });
  [els.activityKode, els.activitySub, els.activityHppOld, els.activityHppNew, els.activityHjOld, els.activityHjNew, els.activityOld, els.activityNew, els.activityNote].forEach(function (input) {
    input.addEventListener("input", saveActivityDraft);
    input.addEventListener("change", saveActivityDraft);
  });
  els.activityAdd.addEventListener("click", onActivityAdd);
  els.telegramSave.addEventListener("click", saveTelegramSettings);
  els.telegramAutoSend.addEventListener("change", function () {
    const tokenMatches = els.telegramBotToken.value.trim() === telegramSettings.botToken;
    const chatMatches = els.telegramChatId.value.trim() === telegramSettings.chatId;
    if (els.telegramAutoSend.checked && (!tokenMatches || !chatMatches || !telegramSettings.botToken || !telegramSettings.chatId)) {
      els.telegramAutoSend.checked = false;
      setMessage(els.telegramSettingsMessage, "Simpan Bot Token dan Chat ID terlebih dahulu sebelum mengaktifkan pengiriman otomatis.");
      return;
    }
    telegramSettings.autoSendEnabled = els.telegramAutoSend.checked;
    chrome.storage.local.set({ telegramSettings: telegramSettings }, function () {
      setMessage(els.telegramSettingsMessage, telegramSettings.autoSendEnabled ? "Pengiriman otomatis aktif." : "Pengiriman otomatis nonaktif.");
      if (telegramSettings.autoSendEnabled) retryPendingTelegramSends();
    });
  });
  els.activityReset.addEventListener("click", function () {
    els.activityKode.value = "";
    Array.prototype.forEach.call(els.activityActions, function (input) { input.checked = false; });
    els.activitySub.value = "";
    els.activitySubWrap.hidden = true;
    els.activitySub.required = false;
    els.activityHppOld.value = "";
    els.activityHppNew.value = "";
    els.activityHjOld.value = "";
    els.activityHjNew.value = "";
    els.activityOld.value = "";
    els.activityNew.value = "";
    els.activityNote.value = "";
    setActivityError("");
    updateActivitySubAction();
    clearActivityDraft();
  });
  els.activityPickFile.addEventListener("click", onActivityPickFile);
  els.activityFilter.addEventListener("input", function () {
    // A new filter can leave you on a page that no longer exists; paginate()
    // clamps it, but starting from page 1 is what people expect.
    activityPage = 1;
    renderActivityHistory();
  });
  els.activityPageFirst.addEventListener("click", function () {
    goToActivityPage(1);
  });
  els.activityPagePrev.addEventListener("click", function () {
    goToActivityPage(activityPage - 1);
  });
  els.activityPageNext.addEventListener("click", function () {
    goToActivityPage(activityPage + 1);
  });
  els.activityPageLast.addEventListener("click", function () {
    goToActivityPage(activityPageCount);
  });
  [els.visibilityDistribution, els.visibilitySellingPrice, els.visibilityKw2, els.visibilityFob, els.visibilityActivity].forEach(function (input) {
    input.addEventListener("change", updatePanelVisibility);
  });
  els.mode.addEventListener("change", function () {
    rebuildQtyColors();
  });
  els.colors.addEventListener("input", function () {
    if (els.mode.value === MODE_MANUAL) rebuildQtyColors();
  });

  // Enter in any input triggers the calculation for its panel.
  const pluInputs = [els.qty, els.colors, els.mode].concat(
    SIZES.map(function (s) {
      return els.ratios[s];
    }),
  );
  pluInputs.forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        onCalculate();
      }
    });
  });
  [els.kurs, els.rmb].forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        onPriceCalculate();
      }
    });
  });
  els.kw2Hpp.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      onKW2Calculate();
    }
  });
  [els.fobQty, els.fobDiscount, els.fobHpp, els.fobAccessories].forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        onHppFobCalculate();
      }
    });
  });

  // Wait for visibility and input state before revealing the popup, so
  // hidden panels never flash and the visible result is recomputed once.
  let loadedPlu = false;
  let loadedKw2 = false;
  let loadedHppFob = false;
  let loadedVisibility = false;
  let loadedActivityDraft = false;
  let loadedOpenPanel = false;
  let savedPluState = null;
  let savedKw2State = null;
  let savedHppFobState = null;
  let savedActivityDraft = null;
  let savedOpenPanel = null;

  function initializePopup() {
    if (!loadedPlu || !loadedKw2 || !loadedHppFob || !loadedVisibility || !loadedActivityDraft || !loadedOpenPanel) return;
    if (savedOpenPanel && PANEL_KEYS.indexOf(savedOpenPanel) !== -1) {
      openPanel = savedOpenPanel;
    }
    applyState(savedPluState);
    applyKW2State(savedKw2State);
    applyHppFobState(savedHppFobState);
    applyActivityDraft(savedActivityDraft);
    applyPanelVisibility();
    document.body.classList.remove("loading");
    renderActiveResults();
    // Focus the first field of whichever panel is actually open.
    if (!panelVisibility[openPanel]) return;
    const focusTarget = {
      distribution: els.qty,
      sellingPrice: els.kurs,
      kw2: els.kw2Hpp,
      hppFob: els.fobQty,
      activityLog: els.activityKode,
    }[openPanel];
    if (focusTarget) focusTarget.focus();
  }

  PLUStore.load(function (state) {
    savedPluState = state;
    loadedPlu = true;
    initializePopup();
  });
  PLUStore.loadKW2(function (state) {
    savedKw2State = state;
    loadedKw2 = true;
    initializePopup();
  });
  PLUStore.loadHppFob(function (state) {
    savedHppFobState = state;
    loadedHppFob = true;
    initializePopup();
  });
  PLUStore.loadVisibility(function (state) {
    if (state) {
      panelVisibility = {
        distribution: state.distribution,
        sellingPrice: state.sellingPrice,
        kw2: state.kw2,
        hppFob: typeof state.hppFob === "boolean" ? state.hppFob : true,
        activityLog: typeof state.activityLog === "boolean" ? state.activityLog : true,
      };
    }
    loadedVisibility = true;
    initializePopup();
  });
  PLUStore.loadLogDraft(function (draft) {
    savedActivityDraft = draft;
    loadedActivityDraft = true;
    initializePopup();
  });
  PLUStore.loadOpenPanel(function (key) {
    savedOpenPanel = key;
    loadedOpenPanel = true;
    initializePopup();
  });
  loadTelegramSettings(function () {
    if (panelVisibility.activityLog && activityEntriesLoaded) retryPendingTelegramSends();
  });
  wireAccordion();
})();

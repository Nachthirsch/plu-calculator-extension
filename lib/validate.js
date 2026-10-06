/* lib/validate.js
 *
 * Input parsing and validation. Deliberately limited to exactly what the
 * specification allows - no extra business rules are added on top.
 *
 *   Qty                : non-negative integer
 *   Ratio S..XL        : required non-negative numbers
 *   Ratio Z            : optional; may stay empty
 *   Number of Colors   : positive integer
 *   Qty Color (manual) : each numeric, and their sum must equal Qty exactly
 *   Exchange Rate, RMB : any number greater than 0
 *
 * Depends on the global Fraction class. No throwing of unvalidated input at
 * the calc layer: validation errors surface as Error messages for the UI.
 */
(function (global) {
  "use strict";

  const INT_RE = /^\s*\d+\s*$/;

  function isNonNegInt(text) {
    return INT_RE.test(String(text));
  }

  function parseInputs(qtyText, ratioTexts, colorsText) {
    // Qty: non-negative integer.
    if (!isNonNegInt(qtyText)) {
      throw new Error("Qty must be a non-negative integer.");
    }
    const qty = Number(String(qtyText).trim());

    // Ratio: 4 required non-negative values, plus an optional 5th for Z.
    const labels = PLUCalc.RATIO_SIZES.concat(PLUCalc.OPTIONAL_SIZES);
    const ratios = [];
    for (let i = 0; i < labels.length; i++) {
      const text = String(ratioTexts[i] === undefined ? "" : ratioTexts[i]);
      if (!text.trim()) {
        if (labels[i] === "Z") continue; // the Z ratio may stay empty
        throw new Error("Ratio " + labels[i] + " must be a non-negative number.");
      }
      let value;
      try {
        value = Fraction.parse(text);
      } catch (e) {
        throw new Error("Ratio " + labels[i] + " must be a non-negative number.");
      }
      if (value.isNegative()) {
        throw new Error("Ratio " + labels[i] + " must be a non-negative number.");
      }
      ratios.push(value);
    }

    // Number of Colors: positive integer.
    if (!isNonNegInt(colorsText)) {
      throw new Error("Number of Colors must be a positive integer.");
    }
    const numColors = Number(String(colorsText).trim());
    if (numColors < 1) {
      throw new Error("Number of Colors must be a positive integer.");
    }

    return { qty: qty, ratios: ratios, numColors: numColors };
  }

  function parseQtyColorInputs(qtyColorTexts, qty) {
    if (qty === 0) {
      throw new Error("Qty must be greater than 0 in Manual per Color mode.");
    }

    const qtyColors = [];
    for (const text of qtyColorTexts) {
      try {
        qtyColors.push(Fraction.parse(text));
      } catch (e) {
        throw new Error("Qty Color values must be numeric.");
      }
    }

    let total = new Fraction(0);
    for (const v of qtyColors) total = total.add(v);
    if (!total.equals(new Fraction(qty))) {
      throw new Error("Total Qty Color (" + PLUFormat.formatNumber(total) + ") does not match Qty (" + PLUFormat.formatNumber(new Fraction(qty)) + ").");
    }
    return qtyColors;
  }

  function parsePriceInput(text, fieldName) {
    const value = String(text).trim();
    if (!value) {
      throw new Error(fieldName + " must be a number greater than 0.");
    }
    let parsed;
    try {
      parsed = Fraction.parse(value);
    } catch (e) {
      throw new Error(fieldName + " must be a number greater than 0.");
    }
    if (!parsed.isPositive()) {
      throw new Error(fieldName + " must be a number greater than 0.");
    }
    return parsed;
  }

  function parseKW2Input(hppText) {
    return parsePriceInput(hppText, "KW2 HPP");
  }

  function validateHppFobInput(qtyText, discText, hppText, aksesorisText) {
    if (!isNonNegInt(qtyText)) {
      throw new Error("Qty Total must be a positive integer.");
    }

    let qtyTotal;
    try {
      qtyTotal = Fraction.parse(qtyText);
    } catch (e) {
      throw new Error("Qty Total must be a positive integer.");
    }
    if (!qtyTotal.isPositive()) {
      throw new Error("Qty Total must be a positive integer.");
    }

    let discPercent;
    try {
      discPercent = Fraction.parse(discText);
    } catch (e) {
      throw new Error("Nilai Diskon must be a number between 0 and 100.");
    }
    if (discPercent.isNegative() || discPercent.gt(new Fraction(100))) {
      throw new Error("Nilai Diskon must be a number between 0 and 100.");
    }

    let hppAwal;
    try {
      hppAwal = Fraction.parse(hppText);
    } catch (e) {
      throw new Error("HPP Awal must be a number greater than 0.");
    }
    if (!hppAwal.isPositive()) {
      throw new Error("HPP Awal must be a number greater than 0.");
    }

    let aksesoris;
    try {
      aksesoris = Fraction.parse(aksesorisText);
    } catch (e) {
      throw new Error("Nilai Aksesoris must be a number greater than or equal to 0.");
    }
    if (aksesoris.isNegative()) {
      throw new Error("Nilai Aksesoris must be a number greater than or equal to 0.");
    }

    return {
      qtyTotal: qtyTotal,
      discPercent: discPercent,
      hppAwal: hppAwal,
      aksesoris: aksesoris,
    };
  }

  global.PLUValidate = {
    parseInputs: parseInputs,
    parseQtyColorInputs: parseQtyColorInputs,
    parsePriceInput: parsePriceInput,
    parseKW2Input: parseKW2Input,
    validateHppFobInput: validateHppFobInput,
  };
})(globalThis);

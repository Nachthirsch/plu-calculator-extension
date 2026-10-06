/* tests/tests.js
 *
 * Runs the specification's test cases against the same pure calc modules the
 * popup uses. Open tests/tests.html directly in a browser (or Chrome's
 * "Load unpacked" test page) - no server required.
 *
 * Every assertion below mirrors a case in the Python reference's self_test(),
 * so the extension's numbers are verified to match the original exactly.
 */
(function (global) {
  "use strict";

  const F = function (n, d) {
    return new Fraction(n, d);
  };
  const PLACEHOLDER = PLUCalc.Z_PLACEHOLDER;

  function rowSizes(row) {
    return PLUCalc.SIZE_COLUMNS.map(function (s) {
      return row[s];
    });
  }

  const tests = [];

  function add(name, expect, fn) {
    tests.push({ name: name, expect: expect, run: fn });
  }

  function check(cond, message) {
    if (!cond) throw new Error(message);
  }

  // ---- 1. The spec's headline example ---------------------------------
  add("Qty=5000, ratios 3,3,3,3, 2 colors (Auto Average)", "Pecahan 1250/1250/1250/1250/0 (TOTAL 5000)\n" + "2 color rows: 625/625/625/625/-\n" + "TOTAL row: 1250/1250/1250/1250/- (grand total 5000)", function () {
    const r = PLUCalc.computeDistribution(5000, [F(3), F(3), F(3), F(3)], 2);
    check(rowSizes(r.pecahan).join(",") === "1250,1250,1250,1250,0", "pecahan row");
    check(r.pecahanTotal.equals(F(5000)), "pecahan total");
    check(r.colorRows.length === 2, "exactly 2 color rows");
    for (const row of r.colorRows) {
      check(rowSizes(row).join(",") === "625,625,625,625,-", "color row");
    }
    check(rowSizes(r.totals).join(",") === "1250,1250,1250,1250,-", "totals row");
    check(r.grandTotal === 5000, "grand total");
  });

  // ---- 2. Empty Ratio Z -----------------------------------------------
  add('Empty Ratio Z shows 0 / "-" and does not disturb the total', 'Pecahan Z = 0, color and TOTAL Z = "-",\n' + "sizes stay exact: TOTAL = 5000", function () {
    const r = PLUCalc.computeDistribution(5000, [F(3), F(3), F(3), F(3)], 2);
    check(r.pecahan.Z.equals(F(0)), "Z pecahan is 0");
    check(r.colorRows[0].Z === PLACEHOLDER, 'color Z is "-"');
    check(r.totals.Z === PLACEHOLDER, 'totals Z is "-"');
    check(r.grandTotal === 5000, "grand total");
  });

  // ---- 3. Provided Ratio Z --------------------------------------------
  add("Provided Ratio Z distributes like the other sizes", "Qty=4800, ratios 2,2,3,3,2, 2 colors\n" + "Pecahan 800/800/1200/1200/800 (TOTAL 4800)\n" + "color rows 400/400/600/600/400 x2\n" + "TOTAL 800/800/1200/1200/800", function () {
    const r = PLUCalc.computeDistribution(4800, [F(2), F(2), F(3), F(3), F(2)], 2);
    check(rowSizes(r.pecahan).join(",") === "800,800,1200,1200,800", "pecahan row");
    check(r.pecahanTotal.equals(F(4800)), "pecahan total");
    for (const row of r.colorRows) {
      check(rowSizes(row).join(",") === "400,400,600,600,400", "color row");
    }
    check(rowSizes(r.totals).join(",") === "800,800,1200,1200,800", "totals row");
    check(r.grandTotal === 4800, "grand total");
  });

  // ---- 4. Uneven ratios (no fixed divisor) ----------------------------
  add("Uneven ratios keep every size total exact", "Qty=3000, ratios 2,4,4,3,2, 2 colors\n" + "Pecahan 400/800/800/600/400 (TOTAL 3000)\n" + "color rows 200/400/400/300/200 x2", function () {
    const r = PLUCalc.computeDistribution(3000, [F(2), F(4), F(4), F(3), F(2)], 2);
    check(rowSizes(r.pecahan).join(",") === "400,800,800,600,400", "pecahan row");
    check(r.pecahanTotal.equals(F(3000)), "pecahan total");
    for (const row of r.colorRows) {
      check(rowSizes(row).join(",") === "200,400,400,300,200", "color row");
    }
    check(r.grandTotal === 3000, "grand total");
  });

  // ---- 5. Zero Qty -----------------------------------------------------
  add("Qty = 0 is allowed (Auto Average)", "all sizes 0, TOTAL 0, grand total 0", function () {
    const r = PLUCalc.computeDistribution(0, [F(3), F(3), F(3), F(3)], 2);
    check(rowSizes(r.pecahan).join(",") === "0,0,0,0,0", "pecahan row");
    check(r.grandTotal === 0, "grand total");
  });

  // ---- 6. All ratios zero ---------------------------------------------
  add("All ratios zero is rejected", "throws an error", function () {
    let threw = false;
    try {
      PLUCalc.computeDistribution(100, [F(0), F(0), F(0), F(0)], 1);
    } catch (e) {
      threw = true;
    }
    check(threw, "all-zero ratio must be rejected");
  });

  // ---- 7. Zero number of colors ---------------------------------------
  add("Number of Colors = 0 is rejected by validation", 'throws "Number of Colors must be a positive integer."', function () {
    let message = null;
    try {
      PLUValidate.parseInputs("5000", ["3", "3", "3", "3", ""], "0");
    } catch (e) {
      message = e.message;
    }
    check(message === "Number of Colors must be a positive integer.", "message");
  });

  // ---- 8. Valid manual color quantities -------------------------------
  add("Valid manual Qty Color values (sum equals Qty)", "Qty=1000, ratios 3,3,3,3, manual [800, 200]\n" + "Pecahan 250/250/250/250/0\n" + "color rows: 200/200/200/200/- and 50/50/50/50/-\n" + "TOTAL 250/250/250/250/- (grand total 1000)", function () {
    const r = PLUCalc.computeManualDistribution(1000, [F(3), F(3), F(3), F(3)], 2, [F(800), F(200)]);
    check(rowSizes(r.pecahan).join(",") === "250,250,250,250,0", "pecahan row");
    check(rowSizes(r.colorRows[0]).join(",") === "200,200,200,200,-", "color 1");
    check(rowSizes(r.colorRows[1]).join(",") === "50,50,50,50,-", "color 2");
    check(rowSizes(r.totals).join(",") === "250,250,250,250,-", "totals row");
    check(r.grandTotal === 1000, "grand total");
  });

  // ---- 9. Invalid manual color quantity totals ------------------------
  add("Invalid manual Qty Color total is rejected", "Qty=1000, manual [700, 200] -> validation error", function () {
    const parsed = PLUValidate.parseInputs("1000", ["3", "3", "3", "3", ""], "2");
    let message = null;
    try {
      PLUValidate.parseQtyColorInputs(["700", "200"], parsed.qty);
    } catch (e) {
      message = e.message;
    }
    check(message !== null && message.indexOf("does not match Qty") !== -1, "sum mismatch must be rejected: " + message);
  });

  // ---- 10. Manual mode: correction lands on the first largest --------
  add("Manual rounding correction applies to the first largest Qty Color", "integer Pecahan columns absorb their rounding difference there", function () {
    const r = PLUCalc.computeManualDistribution(1000, [F(3), F(3), F(3), F(3)], 3, [F(500), F(300), F(200)]);
    for (const size of PLUCalc.RATIO_SIZES) {
      check(r.totals[size] === 250, size + " column total matches Pecahan");
    }
    check(r.grandTotal === 1000, "grand total");

    // Pecahan = 25 per size; raw cells are 12.5 / 7.5 / 5, so naive
    // half-up rounding gives 13 + 8 + 5 = 26. The first largest Qty Color
    // (500) absorbs the -1 difference and lands on 12.
    const c = PLUCalc.computeManualDistribution(100, [F(1), F(1), F(1), F(1)], 3, [F(50), F(30), F(20)]);
    check(c.colorRows[0].S === 12, "largest color takes the correction");
    check(c.colorRows[1].S === 8, "other colors keep their half-up value");
    check(c.colorRows[2].S === 5, "smallest color is unaffected");
    check(c.totals.S === 25, "column total matches the integer Pecahan");
    check(c.grandTotal === 100, "grand total");
  });

  // ---- 11. .5 rounding behavior ---------------------------------------
  add("round-half-up: 2.4 -> 2, 2.5 -> 3, 2.6 -> 3", "halves round up; never banker's rounding", function () {
    check(Fraction.roundHalfUp(new Fraction(24, 10)) === 2n, "2.4 -> 2");
    check(Fraction.roundHalfUp(new Fraction(25, 10)) === 3n, "2.5 -> 3");
    check(Fraction.roundHalfUp(new Fraction(26, 10)) === 3n, "2.6 -> 3");
    check(Fraction.roundHalfUp(new Fraction(35, 10)) === 4n, "3.5 -> 4");
    check(Fraction.roundHalfUp(new Fraction(5, 2)) === 3n, "5/2 -> 3");
    check(Fraction.roundHalfUp(new Fraction(7, 2)) === 4n, "7/2 -> 4");
    // A .5 *fractional size* (5/2 per color) still floors: 5/4 = 1.25 -> 1,
    // so the plain column sum is 2 while Pecahan is 5 - no auto adjustment.
    const r = PLUCalc.computeDistribution(5, [F(1), F(1), F(1), F(1)], 2);
    check(PLUFormat.formatNumber(r.pecahan.S) === "1.25", "Pecahan stays exact");
    check(r.colorRows[0].S === 1 && r.colorRows[1].S === 1, "1.25 -> 1 per color");
    check(r.totals.S === 2, "no auto adjustment in Auto Average");
  });

  // ---- 12. Selling price: the spec's worked example -------------------
  add("Selling price: Exchange Rate = 2700, RMB Amount = 98", "HPP_IDR = 264.600\nN1_low = 756.000, N1_high = 778.235,29…\n" + "N1 = 775.000 (multiple of 25.000)\nHJ = 825.000", function () {
    const r = PLUCalc.computeSellingPrice(F(2700), F(98));
    check(r.hppIdr.equals(F(264600)), "HPP IDR");
    check(r.n1Low.equals(F(756000)), "N1 low bound");
    check(r.n1High.equals(F(13230000, 17)), "N1 high bound");
    check(r.n1.equals(F(775000)), "N1");
    check(r.n1Margin.equals(F(2552, 3875)), "N1 margin");
    check(r.hj.equals(F(825000)), "HJ");
    check(r.hjMargin.equals(F(934, 1375)), "HJ margin");
  });

  // ---- 13. Selling price: no multiple fits -> fallback ---------------
  add("Selling price fallback when no ending-5000 multiple fits", "Kurs=2000, RMB=50: N1 = 295.000, HJ = 345.000,\n" + "N1 >= N1_low (margin exceeds 66%)", function () {
    const r = PLUCalc.computeSellingPrice(F(2000), F(50));
    check(r.hppIdr.equals(F(100000)), "HPP IDR");
    check(r.n1Low.equals(F(2000000, 7)), "N1 low bound");
    check(r.n1.equals(F(295000)), "N1 fallback");
    check(r.hj.equals(F(345000)), "HJ fallback");
    check(r.n1.ge(r.n1Low), "fallback N1 >= N1_low");
    check(r.n1Margin.gt(PLUCalc.PRICE_MARGIN_MAX), "fallback exceeds the range");
  });

  // ---- 14. Selling price invariants over a range of inputs -----------
  add("Selling price invariants (HJ ends in 5000, N1 whole and >= N1_low)", "checked for Kurs in {1000, 2700, 2700.5} x RMB 1..500", function () {
    const kursValues = [F(1000), F(2700), F(5401, 2)];
    for (const kurs of kursValues) {
      for (let rmb = 1; rmb <= 500; rmb++) {
        const r = PLUCalc.computeSellingPrice(kurs, F(rmb));
        check(r.hj.mod(10000).equals(F(5000)), "HJ ends in 5000");
        check(r.hj.equals(r.n1.add(PLUCalc.PRICE_ADDON)), "HJ = N1 + 50000");
        check(r.n1.isInteger(), "N1 is whole rupiah");
        check(r.n1.ge(r.n1Low), "N1 >= N1_low");
      }
    }
  });

  // ---- 15. Validation surface -----------------------------------------
  add("Validation accepts decimals and rejects bad input", "Ratio Z optional; Qty/Colors integer; price inputs > 0", function () {
    let p = PLUValidate.parseInputs("120", ["2", "3", "4", "4", ""], "3");
    check(p.ratios.length === 4, "empty Z ratio is dropped");
    p = PLUValidate.parseInputs("120", ["2", "3", "4", "4", "2"], "3");
    check(p.ratios.length === 5, "given Z ratio is kept");
    check(p.ratios[4].equals(F(2)), "Z ratio value");

    let message = null;
    try {
      PLUValidate.parseInputs("120", ["2", "3", "", "4", ""], "3");
    } catch (e) {
      message = e.message;
    }
    check(message === "Ratio L must be a non-negative number.", "required ratio");

    message = null;
    try {
      PLUValidate.parseInputs("-5", ["2", "3", "4", "4", ""], "3");
    } catch (e) {
      message = e.message;
    }
    check(message === "Qty must be a non-negative integer.", "negative qty");

    message = null;
    try {
      PLUValidate.parsePriceInput("0", "Exchange Rate");
    } catch (e) {
      message = e.message;
    }
    check(message === "Exchange Rate must be a number greater than 0.", "zero price");

    check(PLUValidate.parsePriceInput("2700.5", "Exchange Rate").equals(F(5401, 2)), "decimal price input");
  });

  // ---- 16. Formatting helpers -----------------------------------------
  add("Formatting: grouping, decimals and percentages", "264.600,00 / 778.235,29~ / 825.000,00 / 65,86% / 67,93%", function () {
    check(PLUFormat.formatRupiah(F(825000)) === "825.000", "rupiah grouping");
    check(PLUFormat.formatRupiahExact(F(264600)) === "264.600,00", "whole rupiah exact");
    check(PLUFormat.formatRupiahExact(F(13230000, 17)) === "778.235,29~", "non-whole");
    check(PLUFormat.formatPercent(F(2552, 3875)) === "65,86%", "percent 65,86%");
    check(PLUFormat.formatPercent(F(934, 1375)) === "67,93%", "percent 67,93%");
    check(PLUFormat.formatNumber(F(1250)) === "1250", "whole number");
  });

  // ---- 17. HJ KW2: worked example -------------------------------------
  add("HJ KW2: HPP = 264600", "raw = 5292000/13, HJ KW2 = 409000", function () {
    const r = PLUCalc.computeKW2SellingPrice(F(264600));
    check(r.hpp.equals(F(264600)), "HPP IDR");
    check(r.hjKw2Raw.equals(F(5292000, 13)), "raw KW2 price");
    check(r.hjKw2.equals(F(409000)), "HJ KW2");
    check(r.margin.equals(F(35, 100)), "KW2 margin is exactly 35%");
  });

  // ---- 18. HJ KW2: second example ------------------------------------
  add("HJ KW2: HPP = 100000", "raw = 2000000/13, HJ KW2 = 159000", function () {
    const r = PLUCalc.computeKW2SellingPrice(F(100000));
    check(r.hpp.equals(F(100000)), "HPP IDR");
    check(r.hjKw2Raw.equals(F(2000000, 13)), "raw KW2 price");
    check(r.hjKw2.equals(F(159000)), "HJ KW2");
  });

  // ---- 19. HJ KW2: exact boundary ------------------------------------
  add("HJ KW2 exact boundary moves to the ending-9000 price", "HPP=529750 -> raw 815000, HJ KW2 = 819000", function () {
    const r = PLUCalc.computeKW2SellingPrice(F(529750));
    check(r.hpp.equals(F(529750)), "HPP IDR");
    check(r.hjKw2Raw.equals(F(815000)), "raw KW2 price");
    check(r.hjKw2.equals(F(819000)), "HJ KW2");
  });

  // ---- 20. HJ KW2: exact whole value with wrong ending ----------------
  add("HJ KW2 bumps an exact whole price to ending 9000", "HPP=650000 -> raw 1000000, HJ KW2 = 1009000", function () {
    const r = PLUCalc.computeKW2SellingPrice(F(650000));
    check(r.hjKw2Raw.equals(F(1000000)), "raw KW2 price");
    check(r.hjKw2.equals(F(1009000)), "HJ KW2");
  });

  // ---- 21. HJ KW2: ending flag off ------------------------------------
  add("HJ KW2 can use ceil without the ending-5000 rule", "HPP=264600 -> HJ KW2 = 407077 when flag is false", function () {
    const r = PLUCalc.computeKW2SellingPrice(F(264600), false);
    check(r.hjKw2.equals(F(407077)), "HJ KW2 without ending rule");
    check(r.hjKw2.ge(r.hjKw2Raw), "ceil is not below raw price");
  });

  // ---- 22. HJ KW2: invariants over a range ----------------------------
  add("HJ KW2 invariants hold across integer and decimal inputs", "ending 5000, whole rupiah, less than 10000 above raw", function () {
    const kursValues = [F(2700), F(5401, 2), F(2000)];
    const rmbValues = [];
    for (let rmb = 1; rmb <= 500; rmb++) rmbValues.push(F(rmb));
    rmbValues.push(F(985, 10), F(12345, 100));
    for (const kurs of kursValues) {
      for (const rmb of rmbValues) {
        const r = PLUCalc.computeKW2SellingPrice(kurs.mul(rmb));
        check(r.hjKw2.isInteger(), "HJ KW2 is an integer");
        check(r.hjKw2.ge(r.hjKw2Raw), "HJ KW2 is not below raw price");
        check(r.hjKw2.mod(10000).equals(F(9000)), "HJ KW2 ending");
        check(r.hjKw2.sub(r.hjKw2Raw).lt(F(10000)), "KW2 rounding gap");
      }
    }
  });

  // ---- 23. HJ KW2: validation -----------------------------------------
  add("HJ KW2 validation accepts positive decimals and rejects bad input", "zero, negative, empty, and non-numeric values are rejected", function () {
    const invalid = ["", "0", "-1", "abc"];
    for (const value of invalid) {
      let rejected = false;
      try {
        PLUValidate.parseKW2Input(value);
      } catch (e) {
        rejected = true;
      }
      check(rejected, "invalid KW2 HPP: " + value);
      rejected = false;
      try {
        PLUValidate.parseKW2Input(value);
      } catch (e) {
        rejected = true;
      }
      check(rejected, "invalid KW2 HPP: " + value);
    }
    const parsed = PLUValidate.parseKW2Input("264600.5");
    check(parsed.equals(F(529201, 2)), "decimal KW2 HPP");
  });

  // ---- 24. HJ KW2: isolation from Harga Jual --------------------------
  add("HJ KW2 does not change the existing Harga Jual calculation", "Kurs=2700, RMB=98 remains N1=775000 and HJ=825000", function () {
    const before = PLUCalc.computeSellingPrice(F(2700), F(98));
    PLUCalc.computeKW2SellingPrice(F(264600));
    const after = PLUCalc.computeSellingPrice(F(2700), F(98));
    check(before.n1.equals(F(775000)), "existing N1 before KW2");
    check(before.hj.equals(F(825000)), "existing HJ before KW2");
    check(after.n1.equals(F(775000)), "existing N1 after KW2");
    check(after.hj.equals(F(825000)), "existing HJ after KW2");
  });

  // ---- 25. HPP FOB: standard worked example ---------------------------
  add("HPP FOB exact formulas: HPP=100000, discount=10%, Qty=50, Aks=1500.5", "90000 / 4500000 / 4995000 / 495000 / 91500.5", function () {
    const p = PLUValidate.validateHppFobInput("50", "10", "100000", "1500.5");
    const r = PLUCalc.computeHppFob(p.hppAwal, p.discPercent, p.qtyTotal, p.aksesoris);
    check(r.hppAfterDisc.equals(F(90000)), "HPP After Disc");
    check(r.dpp.equals(F(4500000)), "DPP");
    check(r.total.equals(F(4995000)), "Total");
    check(r.ppn.equals(F(495000)), "PPN");
    check(r.ppn.equals(r.total.sub(r.dpp)), "PPN equals Total minus DPP");
    check(r.hppPlusAks.equals(F(183001, 2)), "HPP + Aks");
  });

  // ---- 26. HPP FOB: HPP + Aks display rounding -----------------------
  add("HPP FOB HPP + Aks display rounds half up with two decimals", "105335.61 -> 105.336,00; 105335.41 -> 105.335,00; 105335.50 -> 105.336,00; 91500 -> 91.500,00", function () {
    const cases = [
      [F(10533561, 100), 105336n, "105.336,00"],
      [F(10533541, 100), 105335n, "105.335,00"],
      [F(210671, 2), 105336n, "105.336,00"],
      [F(91500), 91500n, "91.500,00"],
    ];
    for (const testCase of cases) {
      check(Fraction.roundHalfUp(testCase[0]) === testCase[1], "rounded whole value");
      check(PLUFormat.formatRupiahRounded(testCase[0]) === testCase[2], "formatted display");
    }
  });

  // ---- 27. HPP FOB: decimal inputs -----------------------------------
  add("HPP FOB preserves decimal fractions", "HPP=45250.75, discount=12.5%, Qty=120, Aks=234.89", function () {
    const p = PLUValidate.validateHppFobInput("120", "12.5", "45250.75", "234.89");
    const r = PLUCalc.computeHppFob(p.hppAwal, p.discPercent, p.qtyTotal, p.aksesoris);
    check(r.hppAfterDisc.equals(F(1267021, 32)), "HPP After Disc");
    check(r.dpp.equals(F(19005315, 4)), "DPP");
    check(r.total.equals(F(2109589965, 400)), "Total");
    check(r.ppn.equals(F(209058465, 400)), "PPN");
    check(r.ppn.equals(r.total.sub(r.dpp)), "PPN equals Total minus DPP");
    check(r.hppPlusAks.equals(F(31863437, 800)), "HPP + Aks");
  });

  // ---- 27. HPP FOB: zero boundaries ----------------------------------
  add("HPP FOB accepts zero discount and zero accessories", "HPP=250000, discount=0%, Qty=10, Aks=0", function () {
    const p = PLUValidate.validateHppFobInput("10", "0", "250000", "0");
    const r = PLUCalc.computeHppFob(p.hppAwal, p.discPercent, p.qtyTotal, p.aksesoris);
    check(r.hppAfterDisc.equals(F(250000)), "HPP After Disc");
    check(r.dpp.equals(F(2500000)), "DPP");
    check(r.total.equals(F(2775000)), "Total");
    check(r.hppPlusAks.equals(F(250000)), "HPP + Aks");
  });

  // ---- 28. HPP FOB: full discount ------------------------------------
  add("HPP FOB accepts full discount", "HPP=80000, discount=100%, Qty=5, Aks=1000", function () {
    const p = PLUValidate.validateHppFobInput("5", "100", "80000", "1000");
    const r = PLUCalc.computeHppFob(p.hppAwal, p.discPercent, p.qtyTotal, p.aksesoris);
    check(r.hppAfterDisc.equals(F(0)), "HPP After Disc");
    check(r.hppPlusAks.equals(F(1000)), "HPP + Aks");
  });

  // ---- 29. HPP FOB: validation surface -------------------------------
  add("HPP FOB validation rejects invalid values and accepts boundaries", "Qty, discount, HPP, and accessories follow their exact bounds", function () {
    const invalid = [
      ["0", "10", "100", "0"],
      ["1.5", "10", "100", "0"],
      ["1", "-1", "100", "0"],
      ["1", "100.1", "100", "0"],
      ["1", "abc", "100", "0"],
      ["1", "10", "0", "0"],
      ["1", "10", "abc", "0"],
      ["1", "10", "100", "-1"],
      ["1", "10", "100", "abc"],
    ];
    for (const values of invalid) {
      let rejected = false;
      try {
        PLUValidate.validateHppFobInput(values[0], values[1], values[2], values[3]);
      } catch (e) {
        rejected = true;
      }
      check(rejected, "invalid HPP FOB input: " + values.join(","));
    }
    const zeroAndFull = PLUValidate.validateHppFobInput("1", "0", "100", "0");
    check(zeroAndFull.discPercent.equals(F(0)), "zero discount boundary");
    const full = PLUValidate.validateHppFobInput("1", "100", "100", "0");
    check(full.discPercent.equals(F(100)), "full discount boundary");
  });

  // ---- 30. HPP FOB: isolation ----------------------------------------
  add("HPP FOB does not change the existing Harga Jual calculation", "Kurs=2700, RMB=98 remains N1=775000 and HJ=825000", function () {
    const before = PLUCalc.computeSellingPrice(F(2700), F(98));
    const p = PLUValidate.validateHppFobInput("50", "10", "100000", "1500.5");
    PLUCalc.computeHppFob(p.hppAwal, p.discPercent, p.qtyTotal, p.aksesoris);
    const after = PLUCalc.computeSellingPrice(F(2700), F(98));
    check(before.n1.equals(F(775000)), "existing N1 before FOB");
    check(before.hj.equals(F(825000)), "existing HJ before FOB");
    check(after.n1.equals(F(775000)), "existing N1 after FOB");
    check(after.hj.equals(F(825000)), "existing HJ after FOB");
  });

  // ---- 31. Activity log pure logic ------------------------------------
  add("Activity log validation accepts required fields and rejects missing fields", "required action and SP sub-action rules", function () {
    let rejected = false;
    try { PLULogic.validateLogEntry({ jenisAksi: [] }); } catch (e) { rejected = true; }
    check(rejected, "missing Kode Artikel");
    rejected = false;
    try { PLULogic.validateLogEntry({ kodeArtikel: "A-1", jenisAksi: [] }); } catch (e) { rejected = true; }
    check(rejected, "empty Jenis Aksi");
    check(PLULogic.validateLogEntry({ kodeArtikel: "A-1", jenisAksi: ["Rubah HPP"] }).jenisAksi[0] === "Rubah HPP", "single action");
    rejected = false;
    try { PLULogic.validateLogEntry({ kodeArtikel: "A-1", jenisAksi: ["Buat SP"] }); } catch (e) { rejected = true; }
    check(rejected, "missing Sub Aksi SP");
    check(PLULogic.validateLogEntry({ kodeArtikel: "A-1", jenisAksi: ["Rubah HPP", "Buat SP"], subAksi: "SP (per LOT)" }).jenisAksi.length === 2, "valid multiple actions");
    rejected = false;
    try { PLULogic.validateLogEntry({ kodeArtikel: "A-1", jenisAksi: ["Unknown"] }); } catch (e) { rejected = true; }
    check(rejected, "unknown action");
    const hpp = PLULogic.validateLogEntry({ kodeArtikel: "A-1", jenisAksi: ["Rubah HPP"] });
    check(hpp.subAksi === null && hpp.catatan === "", "optional defaults");
  });
  add("Activity log builds and formats complete entries", "all fields and copy text are present", function () {
    const values = { kodeArtikel: "ART-7", jenisAksi: ["Create PLU", "Rubah HPP"], subAksi: "", catatan: "Cek", hppLama: "10", hppBaru: "12" };
    const one = PLULogic.buildLogEntry(values, "2026-10-05T07:32:00.000Z");
    const two = PLULogic.buildLogEntry(values, "2026-10-05T07:32:00.000Z");
    check(one.id && one.id !== two.id && one.timestampIso === "2026-10-05T07:32:00.000Z" && one.jenisAksi.join(",") === "Create PLU,Rubah HPP", "entry fields, order, and unique ids");
    const output = PLULogic.formatLogEntryAsText(one, "05 Okt 2026, 14:32");
    check(one.nilaiPerubahan.hpp.lama === "10" && one.nilaiPerubahan.hpp.baru === "12" && one.nilaiPerubahan.hj === null && one.nilaiPerubahan.umum === null, "structured HPP values");
    check(output.indexOf("Aksi:\n- Create PLU\n- Rubah HPP") !== -1 && output.indexOf("- HPP: 10 -> 12") !== -1, "formatted multiple values");
    const spOutput = PLULogic.formatLogEntryAsText(Object.assign({}, one, { jenisAksi: ["Rubah HPP", "Buat SP"], subAksi: "SP (per LOT)" }), "now");
    check(spOutput.indexOf("Aksi:\n- Rubah HPP\n- Buat SP - SP (per LOT)") !== -1, "SP sub-action attaches only to SP");
    const both = PLULogic.formatLogEntryAsText(Object.assign({}, one, { nilaiPerubahan: { hpp: { lama: "1", baru: "2" }, hj: { lama: "3", baru: "4" }, umum: null } }), "now");
    check(both.indexOf("- HPP: 1 -> 2") !== -1 && both.indexOf("- HJ: 3 -> 4") !== -1, "both value pairs");
    const generic = PLULogic.formatLogEntryAsText(Object.assign({}, one, { nilaiPerubahan: { hpp: null, hj: null, umum: { lama: "x", baru: "y" } } }), "now");
    check(generic.indexOf("- Nilai: x -> y") !== -1, "generic value pair");
    const none = PLULogic.formatLogEntryAsText(Object.assign({}, one, { nilaiPerubahan: { hpp: null, hj: null, umum: null } }), "now");
    check(none.indexOf("HPP Lama") === -1 && none.indexOf("HJ Lama") === -1 && none.indexOf("Nilai Lama") === -1, "no empty value pair");
    const old = PLULogic.formatLogEntryAsText({ kodeArtikel: "OLD", jenisAksi: ["Rubah HPP"], subAksi: null, catatan: "", nilaiLama: "old", nilaiBaru: "new" }, "now");
    check(old.indexOf("Perubahan Nilai:\n- Nilai: old -> new") !== -1, "old flat entry compatibility");
  });
  add("Activity log image metadata uses MIME extensions", "PNG metadata is deterministic and absent images stay null", function () {
    const withImage = PLULogic.buildLogEntry({ kodeArtikel: "IMG", jenisAksi: ["Create PLU"], gambar: { mimeType: "image/png" } }, "fixed-id");
    check(withImage.gambar.mimeType === "image/png", "image MIME metadata");
    check(withImage.gambar.fileName === PLULogic.sanitizeForFileName(withImage.id) + ".png", "sanitized image metadata");
    check(!withImage.gambar.fileName.includes(":"), "image filename contains no colon");
    check(PLULogic.extensionForMimeType("image/jpeg") === "jpg" && PLULogic.extensionForMimeType("image/other") === "png", "MIME mapping");
    check(PLULogic.sanitizeForFileName("2026-10-06T02:39:28.201Z-z5ss2byg") === "2026-10-06T02_39_28.201Z-z5ss2byg", "filename sanitization");
    check(PLULogic.buildLogEntry({ kodeArtikel: "NOIMG", jenisAksi: ["Create PLU"] }, "fixed-id").gambar === null, "no image");
    const output = PLULogic.formatLogEntryAsText(withImage, "now");
    check(output.indexOf("Lampiran: " + withImage.gambar.fileName + " (lihat folder images/)") !== -1, "attachment section");
    check(PLULogic.formatLogEntryAsText(Object.assign({}, withImage, { gambar: null })).indexOf("Lampiran:") === -1, "attachment omission");
  });
  add("Activity log formatter uses the structured section template", "aligned metadata, action bullets, HPP value bullet, catatan, and separators", function () {
    const entry = {
      kodeArtikel: "ART-9",
      jenisAksi: ["Rubah HPP", "Buat SP"],
      subAksi: "SP (per LOT)",
      catatan: "Disetujui",
      nilaiPerubahan: { hpp: { lama: "93.500", baru: "94.000" }, hj: null, umum: null },
    };
    const expected = [
      "LOG AKTIVITAS ARTIKEL",
      "======================",
      "Waktu         : 05 Okt 2026, 14:32",
      "Kode Artikel  : ART-9",
      "",
      "Aksi:",
      "- Rubah HPP",
      "- Buat SP - SP (per LOT)",
      "",
      "Perubahan Nilai:",
      "- HPP: 93.500 -> 94.000",
      "",
      "# Catatan:",
      "Disetujui",
      "",
      "======================",
    ].join("\n");
    check(PLULogic.formatLogEntryAsText(entry, "05 Okt 2026, 14:32") === expected, "exact structured template");
  });
  add("Activity log formatter keeps metadata together and omits empty values", "exact metadata spacing and no empty value section", function () {
    const output = PLULogic.formatLogEntryAsText({
      kodeArtikel: "test",
      jenisAksi: ["Create PLU"],
      subAksi: null,
      nilaiPerubahan: { umum: { lama: "", baru: "" } },
      catatan: "",
      gambar: null,
    }, "6 Okt 2026, 09.33");
    const expected = [
      "LOG AKTIVITAS ARTIKEL",
      "======================",
      "Waktu         : 6 Okt 2026, 09.33",
      "Kode Artikel  : test",
      "",
      "Aksi:",
      "- Create PLU",
      "",
      "======================",
    ].join("\n");
    check(output === expected, "exact metadata-only output");
    check(output.indexOf("Perubahan Nilai:") === -1, "empty pairing omitted");
  });
  add("Activity log formatter includes a one-sided value pairing", "one populated side produces a value bullet", function () {
    const output = PLULogic.formatLogEntryAsText({
      kodeArtikel: "test",
      jenisAksi: ["Create PLU"],
      subAksi: null,
      nilaiPerubahan: { umum: { lama: "100", baru: "" } },
      catatan: "",
    }, "now");
    const expected = [
      "LOG AKTIVITAS ARTIKEL",
      "======================",
      "Waktu         : now",
      "Kode Artikel  : test",
      "",
      "Aksi:",
      "- Create PLU",
      "",
      "Perubahan Nilai:",
      "- Nilai: 100 -> -",
      "",
      "======================",
    ].join("\n");
    check(output === expected, "exact one-sided value output");
  });
  add("Activity log formatter separates action section from bullets", "one blank line before Aksi and none between bullets", function () {
    const output = PLULogic.formatLogEntryAsText({
      kodeArtikel: "test",
      jenisAksi: ["Create PLU", "Rubah HPP"],
      subAksi: null,
      nilaiPerubahan: null,
      catatan: "",
    }, "now");
    check(output.indexOf("Kode Artikel  : test\n\nAksi:") !== -1, "one section boundary before actions");
    check(output.indexOf("- Create PLU\n\n- Rubah HPP") === -1, "no blank line between action bullets");
    check(output.indexOf("Aksi:\n- Create PLU\n- Rubah HPP") !== -1, "adjacent action bullets");
  });
  add("Activity log formatter omits empty optional sections", "no value or catatan headings when all optional content is empty", function () {
    const output = PLULogic.formatLogEntryAsText({
      kodeArtikel: "EMPTY",
      jenisAksi: ["Create PLU"],
      subAksi: null,
      catatan: "",
      nilaiPerubahan: { hpp: null, hj: null, umum: null },
    }, "now");
    check(output.indexOf("Perubahan Nilai:") === -1 && output.indexOf("Catatan:") === -1, "optional sections omitted");
  });
  add("Activity log formatter preserves multiline catatan", "catatan line breaks remain verbatim", function () {
    const output = PLULogic.formatLogEntryAsText({
      kodeArtikel: "MULTI",
      jenisAksi: ["Create PLU"],
      subAksi: null,
      catatan: "Baris satu\nBaris dua",
      nilaiPerubahan: { hpp: null, hj: null, umum: null },
    }, "now");
    check(output.indexOf("# Catatan:\nBaris satu\nBaris dua") !== -1, "multiline catatan");
  });
  add("Activity log merges by id and sorts newest first", "duplicates are kept once and timestamps descend", function () {
    const old = { id: "old", timestampIso: "2026-01-01T00:00:00Z" };
    const duplicate = { id: "same", timestampIso: "2026-01-02T00:00:00Z" };
    const newer = { id: "new", timestampIso: "2026-03-01T00:00:00Z" };
    const result = PLULogic.mergeLogEntries([old, duplicate], [duplicate, newer]);
    check(result.length === 3 && result[0].id === "new" && result[1].id === "same" && result[2].id === "old", "merged ordering");
    check(PLULogic.mergeLogEntries([], [old, newer])[0].id === "new", "empty existing");
    const fileEntries = [
      { id: "file-old", timestampIso: "2026-01-01T00:00:00Z" },
      { id: "file-new", timestampIso: "2026-02-01T00:00:00Z" },
    ];
    const pending = [{ id: "pending", timestampIso: "2026-04-01T00:00:00Z" }];
    const fileAndPending = PLULogic.mergeLogEntries(fileEntries, pending);
    check(fileAndPending.length === 3 && fileAndPending[0].id === "pending" && fileAndPending[2].id === "file-old", "file entries plus pending");
    const unchanged = PLULogic.mergeLogEntries(fileEntries, []);
    check(unchanged.length === 2 && unchanged[0].id === "file-new" && unchanged[1].id === "file-old", "empty pending preserves sorted file entries");
  });

  // ---- Indonesian number input ---------------------------------------
  add("Fraction accepts a comma decimal separator", "98,5 -> 197/2", function () {
    check(Fraction.parse("98,5").equals(new Fraction(197, 2)), "comma decimal");
    check(Fraction.parse(",5").equals(new Fraction(1, 2)), "leading comma decimal");
    check(Fraction.parse("-2,25").equals(new Fraction(-9, 4)), "negative comma decimal");
    check(Fraction.parse("0,0").equals(new Fraction(0)), "zero with comma");
  });
  add("Fraction treats dots as thousands separators when a comma is present", "1.500,50 -> 3001/2", function () {
    check(Fraction.parse("1.500,50").equals(new Fraction(3001, 2)), "idn grouped decimal");
    check(Fraction.parse("1.234.567").equals(new Fraction(1234567)), "idn grouped integer");
    check(Fraction.parse(" 1.500,50 ").equals(new Fraction(3001, 2)), "surrounding whitespace");
  });
  add("Fraction keeps the existing dot-decimal and fraction forms", "1.5 and 3/4 are unchanged", function () {
    check(Fraction.parse("1.5").equals(new Fraction(3, 2)), "dot decimal");
    check(Fraction.parse("123.").equals(new Fraction(123)), "trailing dot");
    check(Fraction.parse(".45").equals(new Fraction(9, 20)), "leading dot decimal");
    check(Fraction.parse("3/4").equals(new Fraction(3, 4)), "fraction form");
    check(Fraction.parse(" 1 / 4 ").equals(new Fraction(1, 4)), "spaced fraction form");
  });
  add("Fraction still rejects text that only looks like a number", "garbage and mixed separators throw", function () {
    const bad = ["1,5,5", "1.2.3,4", "abc", "1,2x", ""];
    for (const text of bad) {
      let threw = false;
      try {
        Fraction.parse(text);
      } catch (e) {
        threw = true;
      }
      check(threw, "must reject: " + JSON.stringify(text));
    }
  });
  add("Validators accept comma decimals end to end", "kurs/rmb and FOB inputs parse with commas", function () {
    check(PLUValidate.parsePriceInput("2.700,5", "Exchange Rate").equals(new Fraction(5401, 2)), "kurs comma");
    check(PLUValidate.parsePriceInput("98,25", "RMB Amount").equals(new Fraction(393, 4)), "rmb comma");
    const fob = PLUValidate.validateHppFobInput("50", "10", "100.000", "1.500,50");
    check(fob.aksesoris.equals(new Fraction(3001, 2)), "aksesoris comma");
    check(PLUValidate.parseInputs("5000", ["3", "3,5", "3", "3", ""], "2").ratios[1].equals(new Fraction(7, 2)), "ratio comma");
  });

  // ---- Distribution result serialization (copy support) ---------------
  add("toDistributionTsv renders the whole grid with tabs and newlines", "header, Pecahan, one row per color, TOTAL", function () {
    const r = PLUCalc.computeDistribution(5000, [F(3), F(3), F(3), F(3)], 2);
    const tsv = PLUFormat.toDistributionTsv(r);
    const lines = tsv.split("\n");
    check(lines.length === 5, "header + pecahan + 2 colors + TOTAL");
    check(lines[0] === "S\tM\tL\tXL\tZ\tTOTAL", "header row: " + JSON.stringify(lines[0]));
    check(lines[1] === "1250\t1250\t1250\t1250\t0\t5000", "pecahan row: " + JSON.stringify(lines[1]));
    check(lines[2] === "625\t625\t625\t625\t-\t", "color 1 row: " + JSON.stringify(lines[2]));
    check(lines[3] === "625\t625\t625\t625\t-\t", "color 2 row: " + JSON.stringify(lines[3]));
    check(lines[4] === "1250\t1250\t1250\t1250\t-\t5000", "TOTAL row: " + JSON.stringify(lines[4]));
  });
  add("toDistributionTsv keeps Z values when a ratio is provided", "Z is a real number, not a placeholder", function () {
    const r = PLUCalc.computeDistribution(4800, [F(2), F(2), F(3), F(3), F(2)], 2);
    const lines = PLUFormat.toDistributionTsv(r).split("\n");
    check(lines[1] === "800\t800\t1200\t1200\t800\t4800", "pecahan with Z: " + JSON.stringify(lines[1]));
    check(lines[2] === "400\t400\t600\t600\t400\t", "color row with Z: " + JSON.stringify(lines[2]));
  });
  add("toResultLines renders label/value pairs as tab-separated lines", "one pair per line, empty values preserved", function () {
    const text = PLUFormat.toResultLines([
      ["HPP (Rp)", "264.600,00"],
      ["HJ KW2 (Rp)", ""],
    ]);
    check(text === "HPP (Rp)\t264.600,00\nHJ KW2 (Rp)\t", "exact lines: " + JSON.stringify(text));
  });

  // ---- Reconciliation notice ------------------------------------------
  add("Auto Average reports the rounding gap when totals do not match Qty", "difference = qty - grandTotal", function () {
    const r = PLUCalc.computeDistribution(10, [F(1), F(1), F(1), F(1)], 3);
    check(r.reconciliation.expected === 10, "expected is qty");
    check(r.reconciliation.actual === r.grandTotal, "actual is grand total");
    check(r.reconciliation.difference === 10 - r.grandTotal, "difference");
    check(r.reconciliation.matched === false, "not matched");
  });
  add("Reconciliation reports no gap when totals equal Qty", "matched true, difference 0", function () {
    const r = PLUCalc.computeDistribution(5000, [F(3), F(3), F(3), F(3)], 2);
    check(r.reconciliation.matched === true && r.reconciliation.difference === 0, "matched exactly");
  });
  add("Manual distribution reconciles after its correction pass", "matched true when rounding drift was absorbed", function () {
    // Qty 8 over ratios 2,2,2,2 gives an integer Pecahan of 2 each, so the
    // correction pass runs. Raw cells are 2*4/8=1, 2*2/8=0.5->1, 0.5->1,
    // summing to 3 against a Pecahan of 2, so -1 is absorbed by the first
    // largest Qty Color and the column lands back on 2.
    const r = PLUCalc.computeManualDistribution(8, [F(2), F(2), F(2), F(2)], 3, [F(4), F(2), F(2)]);
    check(rowSizes(r.totals).join(",") === "2,2,2,2,-", "corrected totals: " + rowSizes(r.totals).join(","));
    check(r.grandTotal === 8, "grand total equals qty");
    check(r.reconciliation.matched === true && r.reconciliation.difference === 0, "matched after correction");
  });
  add("Manual distribution can still miss Qty when Pecahan is fractional", "the correction pass only runs on integer Pecahan", function () {
    // Pecahan 2.5 here, so the correction never fires and the gap is real.
    // The notice must report it rather than hide it.
    const r = PLUCalc.computeManualDistribution(10, [F(2), F(2), F(2), F(2)], 3, [F(4), F(3), F(3)]);
    check(r.reconciliation.difference === 10 - r.grandTotal, "difference reported honestly");
  });

  // ---- Log table pagination -----------------------------------------
  add("paginate splits a list into pages of the given size", "5 rows per page by default", function () {
    const p = PLULogic.paginate(12, 5, 1);
    check(p.pageCount === 3 && p.start === 0 && p.end === 5, JSON.stringify(p));
    check(p.hasPrev === false && p.hasNext === true, "first page has no prev");
    check(p.clamped === false, "not clamped");
  });
  add("paginate reports the window on middle and last pages", "start/end track the 1-based page", function () {
    const mid = PLULogic.paginate(12, 5, 2);
    check(mid.start === 5 && mid.end === 10, JSON.stringify(mid));
    check(mid.hasPrev === true && mid.hasNext === true, "middle page has both");
    const last = PLULogic.paginate(12, 5, 3);
    check(last.start === 10 && last.end === 12, JSON.stringify(last));
    check(last.hasPrev === true && last.hasNext === false, "last page has no next");
  });
  add("paginate handles exact multiples and short lists", "no empty trailing page", function () {
    check(PLULogic.paginate(10, 5, 2).pageCount === 2, "exact multiple");
    check(PLULogic.paginate(10, 5, 2).end === 10, "last row is index 10 exclusive");
    const one = PLULogic.paginate(3, 5, 1);
    check(one.pageCount === 1 && one.start === 0 && one.end === 3, "shorter than one page");
    check(one.hasPrev === false && one.hasNext === false, "single page has neither");
  });
  add("paginate clamps an out-of-range page instead of returning nothing", "page 99 -> last, page 0 -> first", function () {
    const high = PLULogic.paginate(12, 5, 99);
    check(high.page === 3 && high.start === 10, JSON.stringify(high));
    check(high.clamped === true, "reports the clamp");
    const low = PLULogic.paginate(12, 5, 0);
    check(low.page === 1 && low.start === 0, JSON.stringify(low));
    check(low.clamped === true, "reports the clamp");
  });
  add("paginate treats an empty or invalid list as one empty page", "never returns zero pages", function () {
    for (const total of [0, -5]) {
      const p = PLULogic.paginate(total, 5, 1);
      check(p.pageCount === 1 && p.page === 1, "pageCount stays 1 for " + total);
      check(p.start === 0 && p.end === 0, "empty window for " + total);
      check(p.hasPrev === false && p.hasNext === false, "no navigation for " + total);
    }
    check(PLULogic.paginate(12, 0, 1).pageCount === 12, "pageSize 0 degrades to one row per page");
  });

  // ---- Telegram opt-in and retry queue helpers -----------------------
  add("Telegram auto-send requires explicit opt-in and both credentials", "only fully valid settings return true", function () {
    check(PLULogic.shouldAutoSend({ autoSendEnabled: false, botToken: "token", chatId: "chat" }) === false, "disabled");
    check(PLULogic.shouldAutoSend({ autoSendEnabled: true, botToken: "", chatId: "chat" }) === false, "missing token");
    check(PLULogic.shouldAutoSend({ autoSendEnabled: true, botToken: "token", chatId: "  " }) === false, "missing chat id");
    check(PLULogic.shouldAutoSend({ autoSendEnabled: true, botToken: "token", chatId: "chat" }) === true, "valid settings");
  });
  add("Telegram pending queue adds without duplicates and removes ids", "queue helpers preserve pending ids", function () {
    const added = PLULogic.addToPendingQueue(["a"], "a");
    check(added.join(",") === "a", "dedupe");
    const withNew = PLULogic.addToPendingQueue(added, "b");
    check(withNew.join(",") === "a,b", "add");
    check(PLULogic.removeFromPendingQueue(withNew, "a").join(",") === "b", "remove");
    check(PLULogic.addToPendingQueue(["1", "2", "3", "4", "5"], "6").join(",") === "2,3,4,5,6", "cap");
  });

  // ---- runner ----------------------------------------------------------
  function runAllTests(tbody, summary) {
    let passed = 0;
    const failures = [];
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      let ok = true,
        detail = "";
      try {
        t.run();
      } catch (e) {
        ok = false;
        detail = e.message;
      }
      if (ok) {
        passed++;
      } else {
        failures.push({ index: i + 1, name: t.name, detail: detail });
      }
      const tr = document.createElement("tr");
      if (!ok) tr.className = "fail";
      const cells = [String(i + 1), t.name, t.expect, ok ? "" : detail || "failed", ok ? "PASS" : "FAIL"];
      for (const text of cells) {
        const cell = document.createElement("td");
        if (text === "PASS" || text === "FAIL") {
          cell.className = text.toLowerCase();
        }
        cell.textContent = text;
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    }

    summary.textContent = passed + " / " + tests.length + " tests passed" + (failures.length ? " — " + failures.length + " FAILED" : " — all passed");
    summary.className = "summary " + (failures.length ? "fail" : "pass");
    if (!failures.length) console.log("ALL TESTS PASSED");
    // Log failures to the console too, for the Load-unpacked console view.
    for (const fail of failures) {
      console.error("Test " + fail.index + " FAILED: " + fail.name + " — " + fail.detail);
    }
    return failures.length === 0;
  }

  global.runAllTests = runAllTests;
  global.pluTestCount = function () {
    return tests.length;
  };
})(globalThis);

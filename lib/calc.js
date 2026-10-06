/* lib/calc.js
 *
 * Pure calculation logic for the PLU calculator. No DOM, no I/O - the same
 * module drives the popup and the test page, so both agree by construction.
 *
 * It is a direct port of the Python reference
 * (plu_qty_per_size_calculator_manual.py) onto an exact BigInt rational
 * core (lib/fraction.js) instead of fractions.Fraction, so no formula changes
 * and no floating-point rounding creeps in anywhere.
 *
 * Depends on the global Fraction class.
 */
(function (global) {
  "use strict";

  const floorDivBig = Fraction.floorDivBig;
  const pmodBig = Fraction.pmodBig;

  const RATIO_SIZES = ["S", "M", "L", "XL"]; // sizes that receive a ratio
  const SIZE_COLUMNS = ["S", "M", "L", "XL", "Z"]; // fixed column order, Z = spare
  const OPTIONAL_SIZES = ["Z"];
  const Z_PLACEHOLDER = "-";
  const MODE_AUTO = "auto";
  const MODE_MANUAL = "manual";

  // Harga Jual constants - fixed by the specification.
  const PRICE_MARGIN_MIN = new Fraction(65, 100);
  const PRICE_MARGIN_MAX = new Fraction(66, 100);
  const PRICE_ADDON = new Fraction(50000);
  const HJ_ENDING = new Fraction(5000);
  const HJ_ENDING_MODULUS = new Fraction(10000);
  const N1_ROUND_STEPS = [new Fraction(25000), new Fraction(5000)];

  // HJ KW2 constants - independent from the Harga Jual constants above.
  const KW2_DIVISOR = new Fraction(65, 100);
  const KW2_HJ_ENDING = new Fraction(9000);
  const KW2_HJ_ENDING_MODULUS = new Fraction(10000);
  const KW2_REQUIRE_ENDING_9000 = true;

  // HPP FOB constants - independent from all other selling-price formulas.
  const FOB_PERCENT_DIVISOR = new Fraction(100);
  const FOB_PPN_RATE = new Fraction(11, 100);

  const ALL_SIZES_ERROR = "4 or 5 ratio values are required";
  const ALL_ZERO_RATIO_ERROR = "the ratio values must not all be zero";

  /** Build the size list that actually carries a ratio: S..XL, plus Z only
   *  when a fifth ratio was given. */
  function distributedSizes(ratios) {
    const count = ratios.length;
    if (count !== 4 && count !== 5) throw new Error(ALL_SIZES_ERROR);
    return RATIO_SIZES.concat(OPTIONAL_SIZES.slice(0, count - 4));
  }

  /** Pecahan[size] = Qty * Ratio[size] / sum(ratios). The divisor is always
   *  the ratio sum, so the Pecahan total always equals Qty. */
  function computePecahan(qty, ratios) {
    const distributed = distributedSizes(ratios);
    let divisor = new Fraction(0);
    for (const ratio of ratios) divisor = divisor.add(ratio);
    if (!divisor.isPositive()) throw new Error(ALL_ZERO_RATIO_ERROR);

    const pecahan = {};
    for (let i = 0; i < distributed.length; i++) {
      pecahan[distributed[i]] = new Fraction(qty).mul(ratios[i]).div(divisor);
    }
    pecahan.Z = pecahan.Z || new Fraction(0); // stays 0 with no fifth ratio

    let pecahanTotal = new Fraction(0);
    for (const size of distributed) pecahanTotal = pecahanTotal.add(pecahan[size]);

    return { distributed: distributed, pecahan: pecahan, pecahanTotal: pecahanTotal };
  }

  function emptyRow(distributed) {
    const row = {};
    for (const size of distributed) row[size] = 0;
    for (const size of OPTIONAL_SIZES) row[size] = Z_PLACEHOLDER;
    return row;
  }

  function columnTotals(distributed, colorRows) {
    const totals = {};
    for (const size of distributed) {
      let sum = 0;
      for (const row of colorRows) sum += row[size];
      totals[size] = sum;
    }
    // distributed holds exactly the sizes that carry a ratio: a spare Z
    // without a ratio is absent from it and keeps its placeholder.
    for (const size of OPTIONAL_SIZES) {
      if (!(size in totals)) totals[size] = Z_PLACEHOLDER;
    }
    return totals;
  }

  /** How far the displayed TOTAL row sits from the Qty that was entered.
   *  Auto Average does no reconciliation by design, so rounding can leave a
   *  gap; Manual absorbs its gap during the correction pass above. The UI
   *  only reports this - it never adjusts anything here. */
  function reconcile(qty, grandTotal) {
    return {
      expected: qty,
      actual: grandTotal,
      difference: qty - grandTotal,
      matched: qty === grandTotal,
    };
  }

  function grandTotalOf(distributed, totals) {
    let grand = 0;
    for (const size of distributed) grand += totals[size];
    return grand;
  }

  /** Auto Average: QtyPerSizePerColor[size] = round_half_up(Pecahan[size] /
   *  NumberOfColors). Exactly num_colors rows; totals are plain sums, with no
   *  adjustment logic applied anywhere. */
  function computeDistribution(qty, ratios, numColors) {
    const base = computePecahan(qty, ratios);
    const rows = [];
    for (let i = 0; i < numColors; i++) {
      const row = emptyRow(base.distributed);
      for (const size of base.distributed) {
        row[size] = Number(Fraction.roundHalfUp(base.pecahan[size].div(numColors)));
      }
      rows.push(row);
    }
    const totals = columnTotals(base.distributed, rows);
    const grandTotal = grandTotalOf(base.distributed, totals);
    return {
      pecahan: base.pecahan,
      pecahanTotal: base.pecahanTotal,
      colorRows: rows,
      totals: totals,
      grandTotal: grandTotal,
      reconciliation: reconcile(qty, grandTotal),
    };
  }

  /** Manual per Color: Value[size][color] = Pecahan[size] * QtyColor[color] /
   *  Qty, rounded half up. When a size's Pecahan is an integer, rounding
   *  differences are absorbed by the first color with the largest Qty Color
   *  - and nowhere else. */
  function computeManualDistribution(qty, ratios, numColors, qtyColors) {
    if (qtyColors.length !== numColors) {
      throw new Error("manual distribution requires one Qty Color per color");
    }
    const base = computePecahan(qty, ratios);

    const rows = [];
    for (let i = 0; i < numColors; i++) {
      const row = emptyRow(base.distributed);
      for (const size of base.distributed) {
        const raw = base.pecahan[size].mul(qtyColors[i].div(new Fraction(qty)));
        row[size] = Number(Fraction.roundHalfUp(raw));
      }
      rows.push(row);
    }

    for (const size of base.distributed) {
      if (!base.pecahan[size].isInteger()) continue;
      let columnSum = 0;
      for (const row of rows) columnSum += row[size];
      const difference = Number(base.pecahan[size].numerator) - columnSum;
      if (difference === 0) continue;

      // The first largest Qty Color takes the whole difference.
      let largest = 0;
      for (let i = 1; i < qtyColors.length; i++) {
        if (qtyColors[i].gt(qtyColors[largest])) largest = i;
      }
      rows[largest][size] += difference;
    }

    const totals = columnTotals(base.distributed, rows);
    const grandTotal = grandTotalOf(base.distributed, totals);
    return {
      pecahan: base.pecahan,
      pecahanTotal: base.pecahanTotal,
      colorRows: rows,
      totals: totals,
      grandTotal: grandTotal,
      reconciliation: reconcile(qty, grandTotal),
    };
  }

  /** Harga Jual: N1 is the first multiple of the largest applicable rounding
   *  step within [N1_low, N1_high] whose HJ ends in 5.000; failing that, the
   *  smallest whole-rupiah value at or above N1_low with that ending. */
  function computeSellingPrice(kurs, rmb) {
    kurs = Fraction.from(kurs);
    rmb = Fraction.from(rmb);
    if (!kurs.isPositive() || !rmb.isPositive()) {
      throw new Error("Exchange Rate and RMB Amount must be numbers greater than 0.");
    }

    const hppIdr = rmb.mul(kurs);

    // margin(P) = (P - HPP) / P  =>  P = HPP / (1 - margin)
    const n1Low = hppIdr.div(new Fraction(1).sub(PRICE_MARGIN_MIN));
    const n1High = hppIdr.div(new Fraction(1).sub(PRICE_MARGIN_MAX));
    const upper = n1High.cmp(n1Low) < 0 ? n1Low : n1High; // ponytail: only reachable if the margins were equal

    let n1 = null;
    for (const step of N1_ROUND_STEPS) {
      // ceil() yields a BigInt multiplier (math.ceil in the reference), so
      // the search below stays in exact integer arithmetic.
      let multiplier = n1Low.div(step).ceil();
      const limit = floorDivBig(upper.n * step.d, upper.d * step.n); // floor(upper / step)
      while (multiplier <= limit) {
        const candidate = step.mul(multiplier);
        if (candidate.add(PRICE_ADDON).mod(HJ_ENDING_MODULUS).equals(HJ_ENDING)) {
          n1 = candidate;
          break;
        }
        multiplier += 1n;
      }
      if (n1) break;
    }
    if (!n1) {
      const base = n1Low.ceil(); // smallest whole-rupiah value >= N1_low (BigInt)
      // Smallest non-negative k with base + k + addon == 5000 (mod 10000).
      n1 = new Fraction(base + pmodBig(HJ_ENDING.sub(base + PRICE_ADDON.n).n, HJ_ENDING_MODULUS.n));
    }

    const hj = n1.add(PRICE_ADDON);
    const n1Margin = n1.sub(hppIdr).div(n1);
    const hjMargin = hj.sub(hppIdr).div(hj);

    return {
      hppIdr: hppIdr,
      n1Low: n1Low,
      n1High: upper,
      n1: n1,
      n1Margin: n1Margin,
      hj: hj,
      hjMargin: hjMargin,
    };
  }

  function computeKW2SellingPrice(hpp, requireEnding9000) {
    hpp = Fraction.from(hpp);
    if (!hpp.isPositive()) {
      throw new Error("KW2 HPP must be a number greater than 0.");
    }

    const hjKw2Raw = hpp.div(KW2_DIVISOR);
    const useEnding9000 = requireEnding9000 === undefined ? KW2_REQUIRE_ENDING_9000 : requireEnding9000;
    let hjKw2 = new Fraction(hjKw2Raw.ceil());

    if (useEnding9000) {
      const adjustment = pmodBig(KW2_HJ_ENDING.n - hjKw2.n, KW2_HJ_ENDING_MODULUS.n);
      hjKw2 = new Fraction(hjKw2.n + adjustment);
    }

    if (!hjKw2.ge(hjKw2Raw) || !hjKw2.isInteger() || (useEnding9000 && !hjKw2.mod(KW2_HJ_ENDING_MODULUS).equals(KW2_HJ_ENDING))) {
      throw new Error("KW2 price rounding invariant failed.");
    }

    const margin = hjKw2Raw.sub(hpp).div(hjKw2Raw);
    if (!margin.equals(new Fraction(35, 100))) {
      throw new Error("KW2 margin invariant failed.");
    }

    return {
      hpp: hpp,
      hjKw2Raw: hjKw2Raw,
      hjKw2: hjKw2,
      margin: margin,
    };
  }

  function computeHppFob(hppAwal, discPercent, qtyTotal, aksesoris) {
    hppAwal = Fraction.from(hppAwal);
    discPercent = Fraction.from(discPercent);
    qtyTotal = Fraction.from(qtyTotal);
    aksesoris = Fraction.from(aksesoris);

    const hppAfterDisc = hppAwal.sub(hppAwal.mul(discPercent).div(FOB_PERCENT_DIVISOR));
    const dpp = hppAfterDisc.mul(qtyTotal);
    const total = dpp.add(dpp.mul(FOB_PPN_RATE));
    const ppn = total.sub(dpp);
    const hppPlusAks = hppAfterDisc.add(aksesoris);

    return {
      hppAfterDisc: hppAfterDisc,
      dpp: dpp,
      total: total,
      ppn: ppn,
      hppPlusAks: hppPlusAks,
    };
  }

  global.PLUCalc = {
    RATIO_SIZES: RATIO_SIZES,
    SIZE_COLUMNS: SIZE_COLUMNS,
    OPTIONAL_SIZES: OPTIONAL_SIZES,
    Z_PLACEHOLDER: Z_PLACEHOLDER,
    MODE_AUTO: MODE_AUTO,
    MODE_MANUAL: MODE_MANUAL,
    PRICE_MARGIN_MIN: PRICE_MARGIN_MIN,
    PRICE_MARGIN_MAX: PRICE_MARGIN_MAX,
    PRICE_ADDON: PRICE_ADDON,
    HJ_ENDING: HJ_ENDING,
    HJ_ENDING_MODULUS: HJ_ENDING_MODULUS,
    N1_ROUND_STEPS: N1_ROUND_STEPS,
    KW2_DIVISOR: KW2_DIVISOR,
    KW2_HJ_ENDING: KW2_HJ_ENDING,
    KW2_HJ_ENDING_MODULUS: KW2_HJ_ENDING_MODULUS,
    KW2_REQUIRE_ENDING_9000: KW2_REQUIRE_ENDING_9000,
    FOB_PERCENT_DIVISOR: FOB_PERCENT_DIVISOR,
    FOB_PPN_RATE: FOB_PPN_RATE,
    computeDistribution: computeDistribution,
    computeManualDistribution: computeManualDistribution,
    computeSellingPrice: computeSellingPrice,
    computeKW2SellingPrice: computeKW2SellingPrice,
    computeHppFob: computeHppFob,
  };
})(globalThis);

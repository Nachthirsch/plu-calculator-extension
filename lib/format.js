/* lib/format.js
 *
 * Display-only formatting helpers. Values enter as Fractions and are never
 * rounded by the math itself here - format_rupiah_exact marks any value it
 * has to truncate for display with a trailing "~".
 *
 * Depends on the global Fraction class from lib/fraction.js, and reads
 * PLUCalc.SIZE_COLUMNS at call time for the tab-separated serializers.
 */
(function (global) {
  "use strict";

  const floorDivBig = Fraction.floorDivBig;

  /** Group a non-negative BigInt with "." as the thousands separator. */
  function groupBig(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /** Whole numbers without a decimal point ("1250"); other values as their
   *  decimal value, like Excel's General format. Matches Python's
   *  format_number: str(float(Fraction)) for non-whole values. */
  function formatNumber(value) {
    const v = Fraction.from(value);
    if (v.isInteger()) return v.numerator.toString();
    return String(v.toNumber());
  }

  /** Whole-rupiah value grouped with "." separators. */
  function formatRupiah(value) {
    const v = Fraction.from(value);
    // ponytail: only integer values are ever passed in; truncate toward zero
    // if a non-integer ever reaches here, matching the original's int().
    const n = v.isInteger() ? v.numerator : v.trunc();
    return (n < 0n ? "-" : "") + groupBig(n < 0n ? -n : n);
  }

  /** Selling-price format: always 2 decimals ("264.600,00"), grouped with ".".
   *  A value needing more than 2 decimals is shown with 2 and a trailing "~"
   *  so the exact value is never silently hidden. DISPLAY ONLY - the math is
   *  never rounded here. */
  function formatRupiahExact(value) {
    const v = Fraction.from(value);
    const scaled = v.mul(100);
    const exact = scaled.isInteger();
    const truncated = exact ? scaled.numerator : floorDivBig(scaled.numerator, scaled.denominator);
    const cents = ((truncated % 100n) + 100n) % 100n;
    return groupBig((truncated - cents) / 100n) + "," + cents.toString().padStart(2, "0") + (exact ? "" : "~");
  }

  /** Whole-rupiah display rounded half up, always with two zero decimals. */
  function formatRupiahRounded(value) {
    return formatRupiah(Fraction.roundHalfUp(Fraction.from(value))) + ",00";
  }

  /** A Fraction margin as a percentage with 2 decimals ("65,86%"). */
  function formatPercent(value) {
    const scaled = Fraction.roundHalfUp(Fraction.from(value).mul(10000)); // BigInt
    const decimals = scaled % 100n;
    return ((scaled - decimals) / 100n).toString() + "," + decimals.toString().padStart(2, "0") + "%";
  }

  /** Serialize a distribution result as tab-separated rows so the whole grid
   *  pastes straight into Excel or a spreadsheet paste. Z keeps its
   *  placeholder "-", and a per-color row leaves the TOTAL cell empty because
   *  the sum belongs to the TOTAL row. */
  function toDistributionTsv(result) {
    const sizes = PLUCalc.SIZE_COLUMNS;
    const lines = [sizes.concat(["TOTAL"]).join("\t")];
    lines.push(
      sizes
        .map(function (size) {
          return String(result.pecahan[size]);
        })
        .concat([String(result.pecahanTotal)])
        .join("\t"),
    );
    for (const row of result.colorRows) {
      lines.push(
        sizes
          .map(function (size) {
            return String(row[size]);
          })
          .concat([""])
          .join("\t"),
      );
    }
    lines.push(
      sizes
        .map(function (size) {
          return String(result.totals[size]);
        })
        .concat([String(result.grandTotal)])
        .join("\t"),
    );
    return lines.join("\n");
  }

  /** Serialize label/value pairs as one tab-separated line each, the shape
   *  used by the single-value panels (Harga Jual, HJ KW2, HPP FOB). */
  function toResultLines(pairs) {
    return (pairs || [])
      .map(function (pair) {
        return String(pair[0]) + "\t" + String(pair[1] === undefined || pair[1] === null ? "" : pair[1]);
      })
      .join("\n");
  }

  global.PLUFormat = {
    formatNumber: formatNumber,
    formatRupiah: formatRupiah,
    formatRupiahExact: formatRupiahExact,
    formatRupiahRounded: formatRupiahRounded,
    formatPercent: formatPercent,
    toDistributionTsv: toDistributionTsv,
    toResultLines: toResultLines,
  };
})(globalThis);

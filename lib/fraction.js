/* lib/fraction.js
 *
 * Exact rational arithmetic on BigInt - a JavaScript mirror of Python's
 * fractions.Fraction. Every calculation in this extension goes through it so
 * results can never depend on binary floating-point representation.
 *
 * Loaded as a classic script; exposes the global class Fraction.
 */
(function (global) {
  'use strict';

  function gcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1n;
  }

  /** Floor of BigInt a / BigInt b, for b > 0. */
  function floorDivBig(a, b) {
    const q = a / b;
    return (a % b) < 0n ? q - 1n : q;
  }

  /** Modulo in [0, b) for b > 0 (matches Python's %, whose result takes the
   *  sign of the divisor). */
  function pmodBig(a, b) {
    const r = a % b;
    return r < 0n ? r + b : r;
  }

  // Integer, "123.", "123.45", ".45", or the fraction form "123/456".
  const PARSE_RE = /^\s*([+-]?)\s*(?:(\d+)\s*\/\s*(\d+)|(\d+)(?:\.(\d*))?|\.(\d+))\s*$/;

  // Indonesian number text: dots only ever in 3-digit groups and at most
  // one comma. "1.500,50" -> "1500.50". Text that does not match this exactly
  // is returned untouched so PARSE_RE rejects it -- "1,5,5" and "1.2.3,4"
  // must never become valid numbers.
  const IDN_RE = /^\s*([+-]?)\s*(\d{1,3}(?:\.\d{3})+|\d*)(?:,(\d*))?\s*$/;

  function normalizeSeparators(text) {
    const raw = String(text);
    const hasComma = raw.indexOf(",") !== -1;
    // Without a comma, more than one dot can only be thousands grouping:
    // a dot-decimal literal never has two.
    if (!hasComma && (raw.match(/\./g) || []).length < 2) return raw;
    const m = IDN_RE.exec(raw);
    if (!m) return raw;
    const whole = m[2].replace(/\./g, "");
    if (!whole && !m[3]) return raw; // nothing but separators
    return m[1] + whole + (m[3] === undefined ? "" : "." + m[3]);
  }

  class Fraction {
    constructor(n, d) {
      if (n instanceof Fraction) {
        this.n = n.n;
        this.d = n.d;
        return;
      }
      if (typeof n === 'string') {
        const parsed = Fraction.parse(n);
        if (d === undefined) { this.n = parsed.n; this.d = parsed.d; return; }
        n = parsed;   // "a/b" numerator: parse it, then apply the caller's d
      }
      if (d === undefined) d = 1n;
      n = BigInt(n);
      d = BigInt(d);
      if (d === 0n) throw new RangeError('Fraction: division by zero');
      if (d < 0n) { n = -n; d = -d; }
      if (n === 0n) { this.n = 0n; this.d = 1n; return; }
      const g = gcd(n, d);
      this.n = n / g;
      this.d = d / g;
    }

    static from(value) {
      return value instanceof Fraction ? value : new Fraction(value);
    }

    /** Parse a decimal or "a/b" string exactly (like Python's Fraction(str)).
     *  Indonesian separators are accepted: "1.500,50" and "98,5". */
    static parse(text) {
      const m = PARSE_RE.exec(normalizeSeparators(text));
      if (!m) throw new SyntaxError('Fraction: invalid literal: ' + text);
      const sign = m[1] === '-' ? -1n : 1n;
      let num, den;
      if (m[2] !== undefined) {                     // a/b
        num = BigInt(m[2]);
        den = BigInt(m[3]);
      } else if (m[4] !== undefined) {              // integer or decimal
        num = BigInt(m[4]);
        den = 1n;
        if (m[5] !== undefined && m[5] !== '') {
          den = 10n ** BigInt(m[5].length);
          num = num * den + BigInt(m[5]);
        }
      } else {                                      // .ddd
        num = BigInt(m[6]);
        den = 10n ** BigInt(m[6].length);
      }
      return new Fraction(sign * num, den);
    }

    /** Round half up: floor(value + 1/2). Returns a BigInt. Quantities in this
     *  app are non-negative, so this is standard round-half-to-nearest. */
    static roundHalfUp(value) {
      const v = Fraction.from(value).add(new Fraction(1, 2));
      return floorDivBig(v.n, v.d);
    }

    get numerator() { return this.n; }
    get denominator() { return this.d; }

    isInteger() { return this.d === 1n; }
    isZero() { return this.n === 0n; }
    isPositive() { return this.n > 0n; }
    isNegative() { return this.n < 0n; }

    add(o) { const b = Fraction.from(o); return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d); }
    sub(o) { const b = Fraction.from(o); return new Fraction(this.n * b.d - b.n * this.d, this.d * b.d); }
    mul(o) { const b = Fraction.from(o); return new Fraction(this.n * b.n, this.d * b.d); }
    div(o) {
      const b = Fraction.from(o);
      if (b.n === 0n) throw new RangeError('Fraction: division by zero');
      return new Fraction(this.n * b.d, this.d * b.n);
    }
    neg() { return new Fraction(-this.n, this.d); }
    abs() { return new Fraction(this.n < 0n ? -this.n : this.n, this.d); }
    mod(o) {
      // Matches Fraction.__mod__ in Python: floor(a / b) * b is computed on
      // the *reduced* quotient, so the remainder comes back reduced and the
      // modulus comparison in computeSellingPrice is exact.
      const b = Fraction.from(o);
      if (b.n === 0n) throw new RangeError('Fraction: division by zero');
      const q = this.div(b).floor();            // BigInt, reduced-quotient floor
      return this.sub(new Fraction(q).mul(b));
    }
    floor() { return floorDivBig(this.n, this.d); }
    ceil() { return -floorDivBig(-this.n, this.d); }
    trunc() {
      return this.n >= 0n ? this.n / this.d : -(-this.n / this.d);
    }

    cmp(o) {
      const b = Fraction.from(o);
      const l = this.n * b.d, r = b.n * this.d;
      return l < r ? -1 : (l > r ? 1 : 0);
    }
    lt(o) { return this.cmp(o) < 0; }
    le(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; }
    ge(o) { return this.cmp(o) >= 0; }
    equals(o) { return this.cmp(o) === 0; }

    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return this.d === 1n ? this.n.toString() : this.n.toString() + '/' + this.d.toString(); }
  }

  Fraction.floorDivBig = floorDivBig;
  Fraction.pmodBig = pmodBig;
  global.Fraction = Fraction;
})(globalThis);

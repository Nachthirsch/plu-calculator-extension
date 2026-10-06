# PLU Qty per Size Calculator — Chrome Extension

A Manifest V3 Chrome extension that ports the original Python/Tkinter
`plu_qty_per_size_calculator_manual.py` to the browser. It runs locally with
no server or Python. All calculations and local log-file operations are
offline; optional Telegram auto-send is the only feature that uses the
internet.

It does five independent jobs:

1. **Qty Distribution (PLU)** — split a total quantity across sizes (S, M, L,
   XL, and an optional Z) and colors.
2. **Selling Price (Harga Jual)** — compute HJ from an RMB cost and exchange
   rate.
3. **HJ KW2** — compute a standalone KW2 selling price from HPP in rupiah.
4. **HPP FOB** — calculate discounted HPP, DPP, total with PPN, and HPP plus accessories.
5. **Log Aktivitas Artikel** — record article changes into a local JSON file.

All arithmetic is exact. There is no floating-point math anywhere in the
calculation: `lib/fraction.js` implements rational arithmetic on `BigInt`
(a JavaScript mirror of Python's `fractions.Fraction`), and every formula runs
on it. Results match the original Python program bit-for-bit — verified by a
differential test against the original code over **24,783 values** (see
"Verifying the numbers" below).

## Project structure

```text
plu-calculator-extension/
├── manifest.json       # Manifest V3, storage plus Telegram host permission
├── popup.html          # markup for all five panels
├── popup.css           # styling
├── popup.js            # DOM only: reads inputs, renders results
├── lib/
│   ├── fraction.js     # exact BigInt rational arithmetic
│   ├── format.js       # display-only formatting
│   ├── calc.js         # pure calculation logic (no DOM)
│   ├── validate.js      # input parsing and validation
│   ├── store.js         # chrome.storage.local wrappers
│   ├── logic-log.js     # pure activity-log validation and formatting
│   ├── log-store.js     # small pending activity-log retry queue
│   ├── log-file.js      # local JSON file and File System Access helpers
│   └── telegram-client.js # optional Telegram transport for activity logs
├── tests/
│   ├── tests.html      # open this file to run the suite in a browser
│   └── tests.js        # the test cases
└── README.md
```

The calculation logic never touches the DOM, and `popup.js` performs no
arithmetic — it converts input text to the pure modules and renders what they
return.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `plu-calculator-extension` folder.

The extension appears in the toolbar. Clicking it opens the popup. No reload
is needed to update results — press **Calculate** or `Enter` in any input.

To update after editing the files: on `chrome://extensions`, click the
extension's **Reload** icon, then reopen the popup.

### Panel toggles

The compact toggle bar at the top controls **Distribusi Qty**, **Harga Jual**,
**HJ KW2**, **HPP FOB**, and **Log Aktivitas** independently. All five panels
are ON by default and can be shown in any combination. Visibility is stored separately under
`panelVisibility` without changing any existing input-storage key.

Hidden panels keep their saved inputs and results. If all five panels are OFF,
the popup shows the message `Tidak ada panel aktif. Aktifkan salah satu di
atas.`.

### Panel accordion

Only one panel body is open at a time. Click any panel title to open it: the
panel you were using collapses back to a single-line header, so the popup no
longer needs scrolling to reach a panel's inputs. The open panel is remembered
under `openPanel`, so reopening the popup returns to the panel you last used
with its first field focused.

Hiding the open panel moves the opening to the first still-visible panel, and
re-showing a panel does not steal the opening. Collapsing never clears
anything: inputs keep their values and recalculate when the panel reopens.

Panel titles are keyboard reachable. With a title focused, **Enter** or
**Space** opens that panel.

Measured in Chrome at the default 560px popup width: with all five panels open
the content is 1426px tall inside a 503px viewport and needs scrolling; with
the accordion it is exactly 503px and does not scroll at all.

## Using it

### Qty Distribution (PLU)

- **Qty** — total quantity, a non-negative integer.
- **Ratio S / M / L / XL** — required, non-negative numbers. They do **not**
  need to sum to 12 or any other value; the divisor is always the sum of the
  ratios.
- **Ratio Z** — optional. Leave empty to keep Z as a reserved column (`0` in
  the Pecahan row, `-` in color and total rows).
- **Colors** — number of colors, a positive integer.
- **Mode**
  - **Auto Average** — each color receives `round_half_up(Pecahan / Colors)`.
    Exactly one row per color.
  - **Manual per Color** — shows one **Qty Color** input per color. Their sum
    must equal **Qty** exactly.

The table shows a **Pecahan** row, one row per color, and a **TOTAL** row of
plain column sums. No adjustment or reconciliation is applied anywhere: a
total is always the sum of the values displayed above it.

#### Worked example

```text
Qty = 5000, Ratios = 3, 3, 3, 3, Colors = 2

Pecahan  1250 1250 1250 1250    0 | 5000
Color 1   625  625  625  625    - |
Color 2   625  625  625  625    - |
TOTAL    1250 1250 1250 1250    - | 5000
```

With a fifth ratio (`Qty = 4800`, ratios `2, 2, 3, 3, 2`, 2 colors) the Z
column distributes like the others: Pecahan `800 / 800 / 1200 / 1200 / 800`,
both colors `400 / 400 / 600 / 600 / 400`.

In **Manual per Color**, each color's share is
`Pecahan * QtyColor / Qty`, rounded half up. If a size's Pecahan is an integer
and rounding makes the column total differ from it, the difference is applied
to the **first color with the largest Qty Color** only:

```text
Qty = 100, Ratios = 1, 1, 1, 1, Colors = 3, Qty Color = 50, 30, 20
Pecahan  25 25 25 25  0 | 100
Color 1  12 12 12 12  -       <- largest Qty Color, absorbs the -1
Color 2   8  8  8  8  -
Color 3   5  5  5  5  -
TOTAL    25 25 25 25  - | 100
```

(13 + 8 + 5 would be 26, one over the integer Pecahan of 25.)

### Selling Price (Harga Jual)

Inputs: **Exchange Rate** (RMB→IDR) and **RMB Amount** (HPP in RMB), both
greater than zero.

```text
HPP_IDR  = RMB * Exchange Rate
N1_low   = HPP_IDR / (1 - 0.65)
N1_high  = HPP_IDR / (1 - 0.66)
margin(P) = (P - HPP_IDR) / P
HJ       = N1 + 50000
```

N1 is the first multiple of 25,000 within `[N1_low, N1_high]` whose final HJ
ends in 5,000; if none fits, multiples of 5,000; if none of those either, the
smallest whole-rupiah value at or above `N1_low` whose HJ ends in 5,000 (which
may exceed `N1_high`).

```text
Exchange Rate = 2700, RMB Amount = 98
HPP (Rp)   = 264.600
N1 bounds  = 756.000 … 778.235,29
N1 (Rp)    = 775.000     (margin 65,86%)
HJ (Rp)    = 825.000     (margin 67,93%)
```

### HJ KW2

HJ KW2 adalah kalkulator mandiri untuk produk atau artikel KW2. Panel ini
memiliki input sendiri dan tidak menggunakan, mengubah, atau memicu kalkulasi
Harga Jual utama.

Input: **HPP (Rp)**, yaitu harga pokok dalam rupiah, dan harus lebih besar dari
nol.

```text
HJ_KW2_raw = HPP / 0.65
```

Dengan `KW2_REQUIRE_ENDING_9000 = true` (default), HJ KW2 adalah nilai rupiah
bulat terkecil yang tidak kurang dari `HJ_KW2_raw` dan berakhiran `9.000`.
Jika flag tersebut bernilai `false`, hasilnya adalah `ceil(HJ_KW2_raw)` tanpa
aturan akhiran. Margin KW2 selalu tepat 35%, dihitung dari harga raw sebelum
pembulatan:

```text
margin = (HJ_KW2_raw - HPP) / HJ_KW2_raw
```

Contoh:

````text
HPP (Rp)      = 264.600
HJ KW2 Raw    = 407.076,92...
HJ KW2 (Rp)   = 409.000,00

Contoh pembulatan:

```text
HPP = 103.000 -> HJ_KW2_raw = 158.461,53... -> HJ KW2 = 159.000,00
157.000        -> 159.000,00
145.000        -> 149.000,00
````

````

Margin KW2 selalu 35%, sehingga berbeda dari target margin 65-66% pada panel
Harga Jual utama. Kedua panel tersebut sepenuhnya independen dari semua fitur
lain. Panel juga menampilkan `HJ_KW2_raw` sebelum pembulatan, bukan hanya harga
final dengan buntut `9.000`.

### HPP FOB

HPP FOB mengikuti workflow SP-FOB: HPP awal dikurangi diskon untuk nilai SP,
kemudian HPP setelah diskon ditambah aksesori untuk menjadi HPP artikel akhir.
Panel ini independen dari empat panel lainnya dan hanya berbagi mekanisme
toggle bar visibility.

Input:

- **Qty Total**: integer positif.
- **Nilai Diskon (%)**: angka dari 0 sampai 100.
- **HPP Awal (Rp)**: angka lebih besar dari 0.
- **Nilai Aksesoris (Rp)**: angka lebih besar atau sama dengan 0.

Semua perhitungan menggunakan `Fraction` exact:

```text
HPP After Disc = HPP Awal - (HPP Awal * Nilai Diskon / 100)
DPP            = HPP After Disc * Qty Total
Total          = DPP + (DPP * 11 / 100)
HPP + Aks      = HPP After Disc + Nilai Aksesoris
```

Contoh: HPP Awal `100.000`, diskon `10%`, Qty Total `50`, dan aksesori
`1.500,50` menghasilkan HPP After Disc `90.000`, DPP `5.000.000`, Total
`5.550.000`, dan HPP + Aks `91.500,50`.

### Log Aktivitas Artikel

The **Log Aktivitas** popup panel records every article change: **Create PLU**,
**Rubah HPP**, **Rubah HJ**, and **Buat SP**.
For Buat SP, the required sub-action is **SP Keseluruhan**, **SP (per LOT)**,
or **SP (per Part)**. Each entry records its automatic timestamp, Kode Artikel,
action, optional Catatan, Nilai Lama, and Nilai Baru.

The selected local **folder** is the single source of truth. Choose it once
with **Pilih Folder Log**. The folder contains `log.json` and an `images/`
subfolder containing pasted screenshots as separate files. The File System
Access API asks for a one-time read/write permission; after that, each new
entry reads the current JSON, merges the entry, and writes it back. Existing
users with the old single-file handle see a one-time notice that the storage
location changed and must choose a new folder; the old file is never
auto-converted.

If a write fails, a small retry queue in `chrome.storage.local` holds at most
five unsaved entries and displays a visible warning. **Coba Simpan Lagi** or
choosing a folder again flushes this queue into `log.json`. This queue is only a
data-loss safeguard, not a second log database.
Use **Salin Teks** on any row to copy a proof-style text block and paste it
manually elsewhere, such as Telegram. To attach an image, focus the
**Screenshot (opsional)** zone and press Ctrl+V. The thumbnail is held only in
memory until **Tambah Log**; if the popup closes first, the pasted image is
lost by design rather than being stored in `chrome.storage`. If image storage
fails after the text entry is saved, the text remains saved and the warning
identifies the separate image failure. A queued text entry does not queue its
binary image.

Telegram auto-send is optional and off by default. It requires your own Bot
Token (create a bot with [@BotFather](https://t.me/BotFather)) and Chat ID. To
find a Chat ID, send a message to the bot, then open
`https://api.telegram.org/bot<TOKEN>/getUpdates` and read the `chat.id` value.
After saving both values, enable **Kirim otomatis ke Telegram**. Each new
entry sends formatted text with `sendMessage`, and an attached screenshot with
`sendPhoto` as a separate call. Failed text sends are kept in a small pending
queue and can be retried from the Log Aktivitas panel; failed photo sends are
not retried because the Blob is intentionally not persisted. This is the only
feature that needs internet access; all calculation panels and local log
operations remain offline.

## Validation

Only the rules the specification defines — nothing extra:

- **Qty** must be a non-negative integer.
- **Ratio S / M / L / XL** are required and must be non-negative.
- **Colors** must be a positive integer.
- In **Manual per Color**: **Qty** must be greater than zero, every **Qty
  Color** value must be numeric, and their sum must equal **Qty** exactly.
- **Exchange Rate** and **RMB Amount** must be greater than zero.
- **HJ KW2** memiliki validasi positif sendiri untuk HPP (Rp).

Invalid input shows a message in the relevant panel and leaves the previous
result untouched. **Reset** clears that panel.

## Input persistence

Everything you type is kept in `chrome.storage.local`, so closing and
reopening the popup restores your inputs and all results exactly as they
were. Only the inputs are stored; results are recomputed from them on load,
so a restored result can never drift from the formulas.

- **Reset** on the PLU or Harga Jual panel wipes the existing `pluInputs_v1`
  state.
- **Reset** on HJ KW2 wipes only the separate `kw2Inputs` state.
- HJ KW2 menyimpan hanya nilai HPP di bawah `kw2Inputs`; state lama berbentuk
  `{kurs, rmb}` diabaikan dengan aman dan tidak mengisi field atau error.
- HPP FOB menyimpan raw input di bawah key terpisah `hppFobInputs`.
- The activity log folder's `log.json` is its source of truth. Only the small
  pending retry queues (`pendingLogEntries` and `pendingTelegramSends`, each
  capped at five entries) are kept in `chrome.storage.local`; the selected
  directory handle is kept in IndexedDB because it cannot be stored in
  `chrome.storage.local`.
- HJ KW2 tidak pernah membaca, mengubah, atau menimpa object `pluInputs_v1`.
- `storage` is used for local settings and small retry queues. The only
  network permission is `https://api.telegram.org/*`, used exclusively by
  optional activity-log Telegram auto-send.

## Running the tests

### In a browser (no tools needed)

Open `tests/tests.html` directly in Chrome (via `Load unpacked` the extension
folder is already trusted, so `file://` works too). The results table prints
immediately, with the expected value beside each actual one; **Re-run tests**
re-executes the suite.

The suite covers: the headline example, empty and provided Ratio Z, uneven
ratios, zero Qty, all ratios zero, zero colors, valid and invalid manual color
quantities, `.5` rounding, the selling price example, HJ KW2 worked examples,
exact boundary and ending behavior, flag-off behavior, KW2 invariants,
validation, and isolation from Harga Jual. It also covers HPP FOB exact
formulas, decimal preservation, discount/accessory boundaries, validation, and
isolation from the existing panels. It also covers activity-log validation,
entry building, the text formatter, and merge/sort behaviour for `PLULogic`.

### From the command line

Node 20+ can run the same suite without a browser:

```bash
node -e '
const fs = require("fs");
const stub = { textContent: "", appendChild() {}, removeChild() {} };
const document = { createElement: () => Object.create(stub) };
for (const f of ["lib/fraction.js", "lib/format.js", "lib/calc.js",
                 "lib/validate.js", "lib/logic-log.js", "tests/tests.js"]) {
  new Function("document", fs.readFileSync(f, "utf8")).call(global, document);
}
const ok = runAllTests(Object.create(stub), Object.create(stub));
console.log(ok ? "ALL TESTS PASSED" : "TEST FAILURES");
'
```

## Verifying the numbers against the original Python

The port is checked against `plu_qty_per_size_calculator_manual.py` directly:
the reference program generates results for 800 cases (176 price, 616
distribution, 8 manual) and the extension's modules are compared value by
value — 24,783 individual checks, all matching.

To reproduce, with both the original `.py` and this folder on disk:

```bash
# 1. Reference cases to JSON (adjust the paths to your own copies)
python - <<'PY'
import importlib.util, fractions, json
spec = importlib.util.spec_from_file_location(
    "ref", "plu_qty_per_size_calculator_manual.py")
ref = importlib.util.module_from_spec(spec); spec.loader.exec_module(ref)
F = fractions.Fraction
out = {"price": [], "dist": [], "manual": []}
for kurs in (2700, F(5401,2), 2000, 1000, 2500, 3000, 999, 10000):
    for rmb in [1,2,3,4,5,7,10,13,20,50,98,100,150,200,250,300,400,500,750,1000,F(985,10),F(12345,100)]:
        r = ref.compute_selling_price(F(kurs), F(rmb))
        out["price"].append({"kurs": str(kurs), "rmb": str(rmb),
            "hppIdr": str(r["hpp_idr"]), "n1Low": str(r["n1_low"]),
            "n1High": str(r["n1_high"]), "n1": str(r["n1"]), "hj": str(r["hj"]),
            "n1Margin": str(r["n1_margin"]), "hjMargin": str(r["hj_margin"])})
for qty in (0,1,2,5,7,120,5000,3000,4800,9999,100000):
    for ratios in ([3,3,3,3],[2,4,4,3,2],[2,2,3,3,2],[1,2,3,4],[2,3,4,4],[5,5,5,5,5],[1,0,0,0],[7,3,5,2,1]):
        for colors in (1,2,3,4,5,7,13):
            r = ref.compute_distribution(qty, [F(x) for x in ratios], colors)
            out["dist"].append({"qty": qty, "ratios": [str(F(x)) for x in ratios], "colors": colors,
                "pecahan": {s: str(r["pecahan"][s]) for s in ref.SIZE_COLUMNS},
                "pecahanTotal": str(r["pecahan_total"]),
                "colorRows": [[str(row[s]) for s in ref.SIZE_COLUMNS] for row in r["color_rows"]],
                "totals": [str(r["totals"][s]) for s in ref.SIZE_COLUMNS],
                "grandTotal": r["grand_total"]})
for qty, ratios, colors, qcs in ((1000,[3,3,3,3],2,[800,200]), (1000,[3,3,3,3],3,[500,300,200]),
        (4800,[2,2,3,3,2],2,[3600,1200]), (1000,[3,3,3,3],2,[999,1]), (100,[2,3,4,4],3,[50,30,20]),
        (7,[1,1,1,1],3,[3,3,1]), (5,[1,1,1,1],2,[3,2]), (17,[2,3,5,7],2,[9,8])):
    r = ref.compute_manual_distribution(qty, [F(x) for x in ratios], colors, [F(x) for x in qcs])
    out["manual"].append({"qty": qty, "ratios": [str(F(x)) for x in ratios], "colors": colors,
        "qtyColors": [str(F(x)) for x in qcs],
        "colorRows": [[str(row[s]) for s in ref.SIZE_COLUMNS] for row in r["color_rows"]],
        "totals": [str(r["totals"][s]) for s in ref.SIZE_COLUMNS],
        "grandTotal": r["grand_total"]})
json.dump(out, open("expected.json", "w"))
print("cases:", len(out["price"]), len(out["dist"]), len(out["manual"]))
PY

# 2. Compare every value
node -e '
const fs = require("fs");
for (const f of ["lib/fraction.js","lib/format.js","lib/calc.js","lib/validate.js"])
  new Function(fs.readFileSync(f, "utf8")).call(global);
const exp = JSON.parse(fs.readFileSync("expected.json", "utf8"));
let n = 0, bad = 0;
const F1 = (v) => new Fraction(v);
const eq = (a, b, label) => { n++; if (a !== b) { bad++; console.log("MISMATCH", label, a, "!=", b); } };
for (const c of exp.price) {
  const r = PLUCalc.computeSellingPrice(F1(c.kurs), F1(c.rmb));
  eq(c.hppIdr, r.hppIdr.toString(), "hpp"); eq(c.n1Low, r.n1Low.toString(), "n1Low");
  eq(c.n1High, r.n1High.toString(), "n1High"); eq(c.n1, r.n1.toString(), "n1");
  eq(c.hj, r.hj.toString(), "hj"); eq(c.n1Margin, r.n1Margin.toString(), "n1Margin");
  eq(c.hjMargin, r.hjMargin.toString(), "hjMargin");
}
for (const c of exp.dist) {
  const r = PLUCalc.computeDistribution(c.qty, c.ratios.map(F1), c.colors);
  for (const s of PLUCalc.SIZE_COLUMNS) eq(c.pecahan[s], r.pecahan[s].toString(), "pecahan " + s);
  eq(c.pecahanTotal, r.pecahanTotal.toString(), "pecahanTotal");
  eq(c.colorRows.length, r.colorRows.length, "row count");
  for (let i = 0; i < c.colorRows.length; i++)
    for (let s = 0; s < PLUCalc.SIZE_COLUMNS.length; s++)
      eq(c.colorRows[i][s], String(r.colorRows[i][PLUCalc.SIZE_COLUMNS[s]]), "row " + i);
  for (let s = 0; s < PLUCalc.SIZE_COLUMNS.length; s++)
    eq(c.totals[s], String(r.totals[PLUCalc.SIZE_COLUMNS[s]]), "totals");
  eq(c.grandTotal, r.grandTotal, "grand");
}
for (const c of exp.manual) {
  const r = PLUCalc.computeManualDistribution(c.qty, c.ratios.map(F1), c.colors, c.qtyColors.map(F1));
  for (let i = 0; i < c.colorRows.length; i++)
    for (let s = 0; s < PLUCalc.SIZE_COLUMNS.length; s++)
      eq(c.colorRows[i][s], String(r.colorRows[i][PLUCalc.SIZE_COLUMNS[s]]), "manual row " + i);
  for (let s = 0; s < PLUCalc.SIZE_COLUMNS.length; s++)
    eq(c.totals[s], String(r.totals[PLUCalc.SIZE_COLUMNS[s]]), "manual totals");
  eq(c.grandTotal, r.grandTotal, "manual grand");
}
console.log("checked", n, "values;", bad === 0 ? "ALL MATCH PYTHON REFERENCE" : bad + " MISMATCHES");
'
```

## Precision notes

- **Exact rationals.** Every intermediate value is a `Fraction` (`BigInt`
  numerator and denominator), never a float. `0.1 + 0.2` style error is
  impossible here.
- **Round half up, never banker's.** `Fraction.roundHalfUp` computes
  `floor(value + 1/2)`. `Math.round` is never used: it rounds `.5` toward
  even, and the spec forbids that.
- **Division by the ratio sum.** `Pecahan[size] = Qty * Ratio[size] /
sum(ratios)`; there is no fixed divisor such as 12.
- **Totals are plain sums.** The TOTAL row is the sum of the displayed
  per-color values, with no adjustment logic. A `.5` fractional size can
  therefore show a column total one below its Pecahan, which is correct.
- **Formatting is display-only.** `formatNumber` shows whole numbers without a
  decimal point and other values as decimals, like Excel's General format;
  `formatRupiahExact` marks any value it must truncate for display with a
  trailing `~`. The math is never rounded for presentation.

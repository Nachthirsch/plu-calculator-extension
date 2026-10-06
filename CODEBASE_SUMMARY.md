# Ringkasan Codebase

## Gambaran Umum

Project ini adalah Chrome Extension Manifest V3 untuk lima kebutuhan:

1. Menghitung distribusi jumlah produk berdasarkan size, ratio, dan warna.
2. Menghitung harga jual dari nilai RMB dan kurs RMB ke IDR.
3. Menghitung harga jual KW2 dari HPP dalam rupiah.
4. Menghitung HPP FOB setelah diskon, PPN, dan aksesori.
5. Mencatat log aktivitas artikel ke file JSON lokal.

Aplikasi berjalan offline tanpa server, Python, network access, atau backend. Satu-satunya permission Chrome yang digunakan adalah `storage` untuk menyimpan input pengguna.

## Struktur File

| File                  | Tanggung jawab                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`       | Konfigurasi Chrome Extension Manifest V3 dan permission storage.                                                          |
| `popup.html`          | Struktur UI untuk lima panel: distribusi, harga jual, HJ KW2, HPP FOB, dan log aktivitas. Memuat seluruh script dalam urutan dependensi. |
| `popup.css`           | Layout, warna, tabel hasil, form, error state, dan responsive overflow.                                                     |
| `popup.js`            | Presentation layer: DOM, panel toggles, validator/kalkulator, rendering hasil, dan orkestrasi activity log.               |
| `lib/fraction.js`     | Aritmetika pecahan eksak berbasis `BigInt`.                                                                               |
| `lib/format.js`       | Formatting angka, rupiah, dan persentase untuk tampilan.                                                                   |
| `lib/calc.js`         | Logika kalkulasi distribusi, harga jual, HJ KW2, dan HPP FOB tanpa DOM atau I/O.                                           |
| `lib/validate.js`     | Parsing serta validasi seluruh input pengguna, termasuk HPP KW2 dan HPP FOB.                                               |
| `lib/store.js`        | Wrapper input storage dan visibility key `panelVisibility`.                                                                |
| `lib/logic-log.js`    | Validasi, pembentukan, formatting, dan merge entri activity log.                                                           |
| `lib/log-store.js`    | Antrean retry kecil (`pendingLogEntries`, maksimum 5 entri) untuk entri yang belum tersimpan ke file.                      |
| `lib/log-file.js`     | File System Access API dan IndexedDB untuk handle file log terpilih, plus baca/tulis JSON.                                |
| `tests/tests.js`      | Test case untuk kalkulator, validator, formatter, invariants harga, dan activity log.                                      |
| `tests/tests.html`    | Halaman browser untuk menjalankan test suite.                                                                              |
| `README.md`           | Dokumentasi instalasi, penggunaan, aturan bisnis, dan verifikasi angka.                                                    |

## Arsitektur dan Alur Data

```text
Input pengguna
    |
    v
popup.js
    |
    +--> lib/validate.js --> Fraction.parse()
    |
    +--> lib/calc.js -----> lib/fraction.js
    |                           |
    +--> lib/format.js <--------+
    |
    +--> render hasil ke DOM
    |
    +--> lib/store.js --> chrome.storage.local
    |
    +--> lib/logic-log.js --> lib/log-store.js (antrean pending)
                |
                +--> lib/log-file.js --> File System Access + IndexedDB handle
```

`popup.js` tidak melakukan aritmetika bisnis. Nilai input divalidasi, diteruskan ke modul kalkulasi, lalu hasilnya diformat dan dirender ke UI.

Toggle bar berada di luar panel kalkulasi. Bar selalu terlihat dan setiap panel
dapat diaktifkan secara independen tanpa mengubah input atau storage panel lain.

## Accordion Panel

Hanya satu body panel yang terbuka pada satu waktu. Panel lain yang masih
terlihat menyempit menjadi header satu baris, sehingga anggaran vertikal
punya ke panel yang sedang dipakai.

- Header panel adalah elemen `h1` dengan `role="button"`, `tabindex="0"`, dan
  `aria-expanded`, ditambah `aria-controls` yang menunjuk body-nya.
- `applyAccordion()` menyetel `is-collapsed` pada section, `hidden` pada body,
  dan `aria-expanded` pada header. Terpisah dari `applyPanelVisibility()`:
  toggle bar menentukan panel mana yang tampil, accordion menentukan mana yang
  ter-expand.
- Menyembunyikan panel yang sedang terbuka akan memindahkan opening ke panel
  terlihat pertama, agar tidak pernah nol panel terbuka. Menampilkan kembali
  panel tidak merebut slot tersebut.
- Menekan header panel yang sudah terbuka tidak melakukan apa-apa, demi alasan
  yang sama.
- Body yang tersembunyikan memakai atribut `hidden`, dan `popup.css` sudah
  punya `[hidden] { display: none !important; }` global, sehingga input di
  dalam panel tertutup tidak bisa di-fokuskan dan tidak masuk ke tab order.
- Menyembunyikan panel tidak menghapus state: input tetap ada di DOM dengan
  nilainya, dan dihitung ulang saat panel dibuka kembali.
- Panel yang terbuka disimpan di key `openPanel`, terpisah dari
  `panelVisibility`. Saat popup dibuka, panel terakhir yang dipakai langsung
  ter-expand dan fokus pindah ke field pertama panel tersebut.

## Modul Aritmetika

`lib/fraction.js` menggunakan pasangan numerator/denominator bertipe `BigInt`. Pecahan selalu direduksi, sehingga operasi berikut tetap eksak:

- tambah, kurang, kali, bagi;
- perbandingan dan equality;
- floor, ceil, trunc, modulo;
- round-half-up;
- parsing integer, desimal, dan format pecahan seperti `123/456`.

Dengan pendekatan ini, hasil kalkulasi tidak bergantung pada floating-point JavaScript.

## Fitur Distribusi Qty

### Input

- `Qty`: integer non-negatif.
- Ratio `S`, `M`, `L`, `XL`: wajib dan non-negatif.
- Ratio `Z`: opsional.
- `Colors`: integer positif.
- Mode `Auto Average` atau `Manual per Color`.

### Perhitungan Pecahan

Untuk setiap size yang aktif:

```text
Pecahan[size] = Qty * Ratio[size] / jumlah seluruh ratio
```

Jika Ratio Z kosong, kolom Z tetap ditampilkan sebagai kolom cadangan: baris `Pecahan` bernilai `0`, sedangkan baris warna dan total memakai placeholder `-`.

### Auto Average

Setiap warna menerima:

```text
round_half_up(Pecahan[size] / jumlah warna)
```

Total warna adalah penjumlahan biasa dari nilai yang tampil. Tidak ada rekonsiliasi otomatis apabila hasil pembulatan membuat total berbeda dari nilai `Pecahan`.

### Manual per Color

Pengguna mengisi satu `Qty Color` untuk setiap warna. Jumlah seluruh `Qty Color` harus sama persis dengan `Qty`, dan `Qty` tidak boleh nol.

Nilai setiap sel dihitung dengan:

```text
round_half_up(Pecahan[size] * QtyColor / Qty)
```

Jika `Pecahan` suatu size adalah integer dan pembulatan membuat total kolom berbeda, selisih diterapkan ke warna pertama dengan `Qty Color` terbesar.

## Fitur Harga Jual

Input:

- Exchange Rate RMB ke IDR, harus lebih besar dari nol.
- RMB Amount atau HPP, harus lebih besar dari nol.

Rumus utama:

```text
HPP_IDR = RMB * Exchange Rate
N1_low  = HPP_IDR / (1 - 0.65)
N1_high = HPP_IDR / (1 - 0.66)
HJ      = N1 + 50.000
```

Pemilihan N1 dilakukan berurutan:

1. Cari kelipatan `25.000` dalam rentang `N1_low` sampai `N1_high` yang menghasilkan HJ berakhiran `5.000`.
2. Jika tidak ada, cari kelipatan `5.000` dengan aturan akhir yang sama.
3. Jika tetap tidak ada, ambil bilangan bulat terkecil yang tidak kurang dari `N1_low` dan menghasilkan HJ berakhiran `5.000`, walaupun melewati `N1_high`.

Semua langkah tersebut dihitung menggunakan pecahan eksak.

## Fitur HJ KW2

HJ KW2 adalah kalkulator standalone yang tidak membaca atau mengubah input
Distribusi Qty maupun Harga Jual. Inputnya hanya satu:

- `HPP (Rp)`: angka positif, integer atau desimal, diparse sebagai `Fraction`.

Perhitungan raw:

```text
HJ_KW2_raw = HPP / 0.65
```

Dengan `KW2_REQUIRE_ENDING_9000 = true`, harga final adalah bilangan bulat
terkecil yang tidak kurang dari `HJ_KW2_raw` dan memiliki buntut `9.000`.
Jika flag dimatikan, harga final adalah `ceil(HJ_KW2_raw)`. Panel menampilkan
`HJ_KW2_raw` secara exact, harga final dengan format rupiah dua desimal, dan
margin tetap `35,00%` berdasarkan harga raw sebelum pembulatan.

Contoh:

```text
HPP 103.000 -> raw 158.461,53... -> HJ KW2 159.000,00
157.000     -> 159.000,00
145.000     -> 149.000,00
```

## Fitur HPP FOB

HPP FOB mengikuti workflow SP-FOB: HPP awal dikurangi diskon untuk SP,
kemudian HPP setelah diskon ditambah aksesori untuk HPP artikel akhir. Panel
ini independent dari tiga panel lain dan hanya berbagi toggle bar visibility.

Inputnya adalah Qty Total positif, Nilai Diskon 0-100%, HPP Awal positif, dan
Nilai Aksesoris non-negatif. Semua arithmetic memakai `Fraction` exact:

```text
HPP After Disc = HPP Awal - (HPP Awal * Nilai Diskon / 100)
DPP            = HPP After Disc * Qty Total
Total          = DPP + (DPP * 11 / 100)
HPP + Aks      = HPP After Disc + Nilai Aksesoris
```

Catatan: DPP memakai HPP **setelah** diskon, bukan HPP Awal. Contoh resmi di
README memakai nilai 90.000, jadi angka example dan kode konsisten; hanya
baris rumus di dokumen ini yang perlu dikoreksi.

## Fitur Log Aktivitas Artikel

Panel kelima mencatat perubahan artikel dengan aksi **Create PLU**, **Rubah
HPP**, **Rubah HJ**, dan **Buat SP**. Untuk **Buat SP**, sub aksi wajib salah
satu dari **SP Keseluruhan**, **SP (per LOT)**, atau **SP (per Part)**.

Layer tanggung jawab:

- `lib/logic-log.js` murni: validasi form, membangun entri dengan
  `id = timestampIso + "-" + random`, memformat entri sebagai blok teks
  (`Salin Teks`), dan merge dua daftar berdasarkan `id` lalu sort
  `timestampIso` descending.
- `lib/log-file.js` menangani File System Access API: memilih file JSON,
  query/request permission `readwrite`, baca, dan tulis. Handle disimpan di
  IndexedDB (`plu-log-db`, store `handles`, key `logFileHandle`) karena
  `chrome.storage.local` tidak bisa menyimpan handle.
- `lib/log-store.js` menyimpan maksimum 5 entri yang gagal ditulis di
  `pendingLogEntries`. Antrean ini hanya safeguard, bukan database kedua.

File JSON terpilih adalah satu-satunya sumber kebenaran. Satu-satunya cache
lama `activityLog` dihapus saat `loadPending()` dipanggil. Field nilai lama
(HPP/HJ/Nilai Lama-Baru) ikut disimpan sebagai draft di `logFormDraft` dengan
debounce 250 ms.

## Validasi dan Error Handling

`lib/validate.js` memisahkan parsing dari kalkulasi. Error dikembalikan sebagai pesan yang ditampilkan pada panel terkait.

Jika input baru tidak valid, hasil sebelumnya tetap dipertahankan. Reset pada masing-masing panel menghapus input, hasil panel, dan state tersimpan.

## Persistence

`popup.js` menyimpan input dengan debounce 250 ms melalui `lib/store.js`. Yang disimpan hanya input, bukan hasil kalkulasi. Saat popup dibuka kembali:

1. Input dibaca dari `chrome.storage.local`.
2. Field manual dibangun ulang bila diperlukan.
3. Hasil distribusi dan harga dihitung ulang dari input tersebut.
4. State KW2 dibaca dari key terpisah `kw2Inputs`; hanya nilai HPP yang
   disimpan. State lama berbentuk `{kurs, rmb}` diabaikan tanpa error.
5. HPP FOB dibaca dari key terpisah `hppFobInputs` dan hanya menyimpan raw
   input string.
6. Visibility panel dibaca dari key terpisah `panelVisibility`, dengan default
   semua panel aktif.
7. Panel yang sedang ter-expand dibaca dari key `openPanel`, terpisah dari
   visibility.
8. Draft activity log dibaca dari key `logFormDraft`, sehingga isian Kode
   Artikel, aksi, nilai lama/baru, dan Catatan tetap ada saat popup ditutup.
9. Inisialisasi popup ditahan sampai keenam async load selesai agar panel yang
   tersembunyi tidak pernah berkedip dan hasil dihitung ulang tepat satu kali.

Dengan demikian, hasil tidak disimpan sebagai cache dan selalu berasal dari rumus terbaru.

## Testing

Test tersedia dalam dua cara:

- Buka `tests/tests.html` di browser.
- Jalankan suite Node yang tercantum di `README.md`.

Cakupan test meliputi:

- distribusi rasio biasa dan rasio Z;
- rasio tidak seimbang;
- Qty nol;
- rasio seluruhnya nol;
- jumlah warna tidak valid;
- distribusi manual dan mismatch total Qty Color;
- aturan koreksi pembulatan manual;
- round-half-up;
- kalkulasi harga jual dan fallback;
- invariants harga jual pada banyak input;
- validasi desimal dan input negatif;
- formatting rupiah, angka, dan persentase.
- HJ KW2 raw, buntut `9.000`, margin exact 35%, dan isolasi dari fitur lain.
- HPP FOB exact formulas, validation boundaries, dan isolation.
- Toggle bar dan persistence panel visibility untuk lima panel.
- Activity log: validasi field wajib, pembangunan entri lengkap, template teks
  formatter (termasuk catatan multiline), serta merge by `id` dan sort
  terbaru lebih dulu.

Validasi terakhir yang dilakukan pada codebase menghasilkan:

```text
ALL TESTS PASSED
```

## Catatan Teknis dan Risiko

- Script dimuat sebagai classic script dan berbagi global `Fraction`, `PLUCalc`, `PLUValidate`, `PLUFormat`, `PLUStore`, `PLULogic`, `PLULogStore`, dan `PLULogFile`.
- Urutan script di `popup.html` penting karena setiap modul bergantung pada global dari file sebelumnya.
- `popup.js` bergantung pada API DOM dan Chrome storage, sehingga test unit berfokus pada modul pure di `lib/`.
- `lib/log-file.js` bergantung pada File System Access API dan IndexedDB, keduanya hanya tersedia di konteks extension (bukan `file://` biasa).
- Test saat ini dijalankan melalui browser atau command Node sederhana, belum menggunakan runner seperti Jest atau Vitest.
- Daftar file yang dimuat di command Node pada README harus selalu sama dengan file yang dirujuk `tests/tests.js`; loader yang kurang satu modul membuat test gagal dengan error "X is not defined".
- Dokumentasi menyebut adanya verifikasi differential terhadap program Python asli; source Python tersebut tidak berada di workspace ini.
- UI menggunakan lebar popup tetap `560px` dengan area scroll vertikal maksimum `600px`.

## Kesimpulan

Codebase memiliki pemisahan tanggung jawab yang jelas: kalkulasi dan validasi terisolasi dari UI, aritmetika memakai representasi eksak, state persistence sederhana, dan test mencakup aturan bisnis utama. Activity log menambah lapisan I/O (File System Access + IndexedDB) dengan antrean retry sebagai safeguard, sementara file JSON tetap menjadi satu-satunya sumber kebenaran. Secara fungsional, suite test yang tersedia lulus seluruhnya.

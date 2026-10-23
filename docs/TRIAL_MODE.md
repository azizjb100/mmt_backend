# Mode Data: REAL & TRIAL

Fitur ini memungkinkan pengguna memakai aplikasi dengan dua sumber data:

| Mode      | Database            | Kegunaan                                            |
| --------- | ------------------- | --------------------------------------------------- |
| **REAL**  | `DB_NAME`           | Data produksi sehari-hari.                          |
| **TRIAL** | `DB_NAME_TRIAL`     | Untuk coba-coba / latihan, **tidak mengubah data real**. |

Mode dipilih **sekali saat login** lewat tombol **REAL / TRIAL** di halaman
login. Setelah masuk, pilihan berlaku untuk seluruh halaman (tidak ada
toggle di header) dan dikirim ke backend sebagai header `X-Data-Mode` pada
setiap request.

---

## Cara Kerja

1. **Frontend** (`src/services/dataMode.ts` + `src/views/LoginView.vue`)
   menyimpan pilihan mode saat login. `src/services/api.ts`
   menambahkan header `X-Data-Mode: real|trial` ke semua request API
   (kecuali `/auth` yang selalu real).
2. **Backend** (`middleware/dataMode.middleware.js`) membaca header tersebut
   lalu menjalankan request di dalam konteks `AsyncLocalStorage`.
3. **`config/db.config.js`** mengekspor `pool` yang otomatis menunjuk ke pool
   real atau trial sesuai konteks request. Semua service/controller yang
   sudah memakai `pool` ikut otomatis — tidak perlu diubah satu per satu.
4. Saat mode trial, nomor transaksi PO External diberi prefix `TRL`
   (contoh `TRL.POE.202600001`) agar mudah dibedakan dari dokumen real.

Karena pemilihan mode disimpan **per-request**, dua pengguna dapat memakai
mode berbeda pada saat yang sama tanpa saling mengganggu.

---

## Setup Sekali Saja

1. Tambahkan di `mmt_backend/.env`:

   ```env
   DB_NAME_TRIAL=kencanaprintnew
   # opsional
   TRIAL_SEED_TABLES=tsupplier,tcustomer,tdivisi,tjenisorder,tspk,tspk_alokasi,tspk_size,tbarang
   TRIAL_EXTRA_SCHEMAS=retail
   TRIAL_CROSS_SCHEMA_TABLES=retail.tpacking,retail.tdc_stbj,retail.tbarangdc_dtl
   ```

2. Jalankan pembuatan database trial:

   ```bash
   cd mmt_backend
   npm run db:trial:init
   ```

   Script ini akan:
   - membuat database sesuai nilai `DB_NAME_TRIAL` (mis. `kencanaprintnew`
     bila sudah ada, struktur akan dilengkapi),
   - meng-clone **struktur** seluruh tabel dari database real,
   - menyalin **data master** saja (supplier, SPK, barang, dll),
   - meng-clone trigger (body yang menulis ke `retail.*` diarahkan ke DB trial),
   - meng-clone view yang ada.

3. Restart backend (jika tidak memakai nodemon), lalu buka aplikasi.

> Jika `DB_NAME_TRIAL` kosong atau DB trial tidak terhubung, tombol TRIAL
> di halaman login dinonaktifkan.

> ⚠️ Jika DB trial **sudah berisi data** (mis. `kencanaprintnew`), jangan
> langsung menjalankan `db:trial:init` karena script menyalin ulang data
> master (TRUNCATE). Script akan menolak dan menyarankan opsi aman. Gunakan
> `db:trial:sync` di bawah untuk melengkapi struktur tanpa menghapus data.

### Menyelaraskan struktur DB trial yang sudah berisi data

```bash
# Lihat perbedaan (dry-run, tidak mengubah apa pun)
npm run db:trial:sync

# Terapkan: tambah kolom yang kurang
npm run db:trial:sync -- --apply

# Sekaligus: buat tabel yang belum ada + perbaiki trigger lintas schema
npm run db:trial:sync -- --apply --create-tables --fix-triggers

# Sekaligus selaraskan tipe kolom yang aman (memperlebar varchar,
# date -> datetime)
npm run db:trial:sync -- --apply --with-types
```

---

## Pemakaian Sehari-hari

- Di halaman login, pilih **REAL** atau **TRIAL** sebelum menekan *Sign In*.
  Halaman login menampilkan nama database trial dan menonaktifkan pilihan
  TRIAL bila DB trial tidak tersedia.
- Setelah login, semua halaman memakai mode yang dipilih. Saat mode trial,
  banner oranye “MODE TRIAL AKTIF” tampil di setiap halaman sebagai penanda.
- Semua transaksi yang disimpan selama mode trial masuk ke DB trial.
- Untuk berganti mode: logout, lalu pilih mode lain di halaman login.
- Logout otomatis membersihkan pilihan mode (kembali ke REAL).

---

## Perintah Perawatan

```bash
# Melengkapi DB trial (aman dijalankan berulang; tabel yang ada dilewati)
npm run db:trial:init

# Struktur saja, tanpa menyalin data master
npm run db:trial:init -- --schema-only

# HAPUS database trial lalu buat ulang dari nol
npm run db:trial:init -- --reset
```

---

## Catatan & Batasan

- **Login selalu memakai DB real** agar sesi pengguna tidak terpengaruh.
- **Hak akses menu (`thakuser`) juga selalu dibaca dari DB real**, supaya
  pengguna tetap bisa membuka menu saat berada di mode trial.
- Tabel master yang disalin bisa diatur lewat `TRIAL_SEED_TABLES`.
  Menjalankan ulang script akan me-reset tabel master trial ke kondisi real.
- Penulisan ke schema lain (mis. `retail.tpacking`) diarahkan ke DB trial
  melalui helper `scopeSchema()`. Struktur tabel schema tersebut ikut
  di-clone (lihat `TRIAL_EXTRA_SCHEMAS`). Trigger yang semula menulis ke
  `retail.*` juga diarahkan ulang ke DB trial saat inisialisasi.
- Pembacaan referensi lintas schema seperti `finance.trekening` masih
  memakai data real (hanya baca).
- File upload/gambar tetap disimpan di folder yang sama; hanya data database
  yang terpisah.
- Realtime socket (mis. Komitmen Kirim) berjalan di luar konteks request
  sehingga selalu memakai DB real.

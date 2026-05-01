# UKK Nilai Importer

Chrome extension untuk mengisi nilai dan penguji internal UKK secara massal di sistem **eRapor SMK Cokrowanadadi** — tanpa CSV, langsung paste dari Excel.

---

## Fitur

- **Generate Siswa** — Ambil otomatis daftar siswa (NISN + Nama) dari halaman input_nilai_ukk
- **Daftar Penguji** — Tampilkan semua nama penguji internal yang tersedia; klik untuk copy
- **Copy Nama** — Copy seluruh nama siswa ke clipboard untuk verifikasi di Excel
- **Paste dari Excel** — Paste nilai atau nama penguji langsung dari kolom Excel ke tabel plugin
- **Isi Form** — Isi otomatis semua input nilai dan dropdown penguji internal di halaman
- **Reset** — Kosongkan semua nilai dan penguji di plugin maupun di halaman

---

## Instalasi

1. Download atau clone repo ini
2. Buka Chrome → `chrome://extensions`
3. Aktifkan **Developer mode** (pojok kanan atas)
4. Klik **Load unpacked** → pilih folder `ukk-nilai-importer`
5. Extension siap digunakan

---

## Cara Pakai

### 1. Buka halaman input nilai UKK

Navigasi ke halaman input nilai UKK di eRapor. Extension hanya aktif di URL:
```
https://eraport.smkcokrowanadadi.sch.id/input_nilai_ukk*
```

### 2. Generate daftar siswa

Klik ikon extension di toolbar Chrome → klik **⚡ Generate Siswa**.

Plugin akan mengambil NISN dan nama semua siswa dari tabel halaman.

### 3. Isi nilai dari Excel

Di Excel, salin kolom nilai (misalnya 34 baris berturut-turut).

Klik cell **Nilai** baris pertama di plugin → **Ctrl+V**.

Nilai akan terdistribusi otomatis ke semua baris di bawahnya.

### 4. Isi penguji internal dari Excel

Sama seperti nilai — salin kolom nama penguji dari Excel, klik cell **Penguji Internal** baris pertama → **Ctrl+V**.

> **Penting:** Nama penguji harus **persis sama** (tidak case-sensitive) dengan nama yang ada di dropdown halaman. Gunakan tombol **👥 Daftar Penguji** untuk melihat daftar nama yang valid, lalu klik nama untuk meng-copy-nya.

### 5. Isi form

Setelah nilai dan penguji terisi, klik **✔ Isi Form**.

Plugin akan mengisi semua input nilai dan memilih penguji di dropdown secara otomatis. Hasil akan ditampilkan di status bar bawah (berapa siswa berhasil diisi, dan jika ada yang tidak ditemukan).

### 6. Reset (opsional)

Klik **↺ Reset** untuk mengosongkan semua nilai dan penguji, baik di plugin maupun di halaman.

---

## Tips

| Situasi | Solusi |
|---|---|
| Penguji tidak terpilih setelah Isi Form | Pastikan nama di plugin **sama persis** dengan nama di Daftar Penguji |
| Siswa tidak ditemukan | NISN di halaman mungkin berbeda — cek via inspeksi elemen |
| Plugin tidak merespons | Pastikan halaman `input_nilai_ukk` sudah terbuka di tab aktif |
| Tombol Generate tidak muncul data | Coba refresh halaman eRapor, lalu klik Generate lagi |

---

## Struktur File

```
ukk-nilai-importer/
├── manifest.json     — Konfigurasi extension (MV3)
├── popup.html        — UI plugin
├── popup.js          — Logika utama: generate, paste, isi form, reset
├── content.js        — Content script: ambil data siswa & penguji dari halaman
└── page_bridge.js    — Jembatan ke jQuery/select2 milik halaman (MAIN world)
```

---

## Catatan Teknis

- Extension menggunakan **Manifest V3**
- Pengisian dropdown select2 dilakukan via `chrome.scripting.executeScript` dengan `world: 'MAIN'` agar bisa mengakses jQuery milik halaman, melewati Content Security Policy (CSP) halaman eRapor
- Pencocokan siswa menggunakan **NISN** sebagai primary key (bukan nama)

# SoundSense

**SoundSense** adalah aplikasi web kurasi, audit kecocokan, dan rekomendasi playlist Spotify berbasis AI dengan antarmuka **Minimalist Editorial Vinyl Showcase**. Aplikasi ini membaca tautan playlist publik Spotify Anda, merangkum suasana musik utamanya, mendeteksi lagu yang terasa keluar jalur di dalam playlist tersebut, serta menyarankan lagu baru beserta alasan musikalnya.

---

## Fitur Utama

- **Analisis Vibe, Mood, & Genre Otomatis:** Membaca hingga 50 lagu pertama dari tautan playlist publik Spotify (`open.spotify.com/playlist/{id}`). Dilengkapi mekanisme **Automatic Public Embed Fallback** yang mengekstrak metadata playlist dari halaman publik Spotify Embed (`__NEXT_DATA__`) apabila endpoint resmi `/v1/playlists/{id}/tracks` mengembalikan `403`, `401`, atau `404`.
- **Rekomendasi Terkurasi & Deteksi Lagu Kurang Cocok:** Menggunakan Google Gemini API untuk menyusun ringkasan karakter playlist, merekomendasikan lagu baru (lengkap dengan alasan kecocokan berbahasa Indonesia dan pencocokan metadata lewat Spotify Search API), serta menandai lagu di playlist asal yang kurang selaras di tab **Kurang Cocok**.
- **Interactive Vinyl Player & Queue Bar:** Pemutar preview audio 30 detik berbasis HTML5 `<audio>` dengan animasi piringan hitam yang berputar saat lagu diputar dan indikator equalizer. Jika `preview_url` dari Spotify kosong, backend otomatis mencari tautan preview `.m4a` melalui iTunes Search API. Dilengkapi tombol **Previous**, **Play/Pause**, **Next**, **Auto-Next**, **Progress Scrubber Bar**, **Volume Slider**, serta mode **Full Track (Spotify)** yang menampilkan Spotify Embed Player langsung di dock bawah layar.
- **Real-Time Synced Lyrics:** Tab **Lirik Lagu** di kolom tengah mengambil lirik lewat endpoint backend yang terhubung ke LRCLIB API. Lirik bertimestamp (`[mm:ss.xx]`) disorot otomatis mengikuti detik pemutaran audio dan dapat diklik untuk meloncat ke bagian lagu tersebut.
- **Riwayat Kurasi Otomatis (`localStorage`):** Setiap hasil analisis otomatis tersimpan di browser pada key `soundsense_history` (maksimal 10 playlist terbaru). Riwayat dapat dibuka instan dari halaman awal maupun lewat drawer **Riwayat** pada bilah atas halaman hasil.

---

## Tech Stack

- **Frontend:** React 19 (Vite), Tailwind CSS v4, Web Audio (`<audio>`), `localStorage`
- **Backend:** Node.js, Express.js, `cors`, `express-rate-limit`, `dotenv`
- **AI & Layanan Eksternal:**
  - **Spotify Web API** (Client Credentials Flow untuk pencarian lagu & metadata track, dengan fallback ke halaman Spotify Embed)
  - **Google Gemini API** (`@google/genai` dengan model fallback `gemini-3-flash-preview` / `gemini-2.5-flash-lite` dan JSON Schema terstruktur)
  - **iTunes Search API** (fallback preview audio 30 detik `.m4a` gratis)
  - **LRCLIB API** (lirik sinkron dan teks penuh gratis)

---

## Struktur Proyek

```text
soundsense/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── spotifyService.js   # Token cache, Embed fallback, Spotify & iTunes enrichment
│   │   │   ├── geminiService.js    # Analisis vibe, rekomendasi, deteksi outlier, model fallback
│   │   │   └── lyricsService.js    # Pencarian lirik LRCLIB + cache memori
│   │   ├── errors.js               # Kelas AppError terstruktur (400/404/502)
│   │   └── index.js                # Express server, CORS, rate limit, /api/recommend, /api/lyrics
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/             # UrlInputView, LoadingStage, VinylShowcase, TrackDetailColumn, TracklistPanel, BottomCoverStrip, HistoryDrawer, Icons
│   │   ├── services/api.js         # Wrapper fetch ke backend
│   │   ├── utils/                  # format.js (durasi & parser LRC), history.js (localStorage)
│   │   ├── App.jsx
│   │   └── index.css
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

---

## Panduan Instalasi & Konfigurasi Lokal

### 1. Prasyarat

- **Node.js v18 atau lebih baru** (termasuk `npm`)
- **Spotify Developer Credentials** (`Client ID` dan `Client Secret` dari [Spotify Developer Dashboard](https://developer.spotify.com/dashboard))
- **Google Gemini API Key** dari [Google AI Studio](https://aistudio.google.com/)

### 2. Konfigurasi Environment Variable

Salin berkas `.env.example` menjadi `.env` di masing-masing folder (`backend` dan `frontend`):

**Backend (`backend/.env`):**

```bash
cp backend/.env.example backend/.env
```

Isi variabel berikut di `backend/.env` (jangan pernah membagikan atau meng-commit kunci asli ke Git):

| Variabel | Keterangan | Contoh |
| --- | --- | --- |
| `PORT` | Port server Express berjalan | `5000` |
| `SPOTIFY_CLIENT_ID` | Client ID aplikasi dari Spotify Developer Dashboard | `isi_client_id_anda` |
| `SPOTIFY_CLIENT_SECRET` | Client Secret aplikasi dari Spotify Developer Dashboard | `isi_client_secret_anda` |
| `GEMINI_API_KEY` | API key dari Google AI Studio untuk Gemini | `isi_gemini_api_key_anda` |
| `FRONTEND_URL` | Origin frontend yang diizinkan oleh CORS (pisahkan koma jika lebih dari satu) | `http://localhost:5173` |

**Frontend (`frontend/.env`):**

```bash
cp frontend/.env.example frontend/.env
```

| Variabel | Keterangan | Contoh |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Alamat dasar API backend yang dipanggil oleh frontend | `http://localhost:5000` |

### 3. Instalasi Dependensi & Menjalankan Server

Buka dua terminal terpisah untuk menjalankan backend dan frontend:

**Terminal 1 (Backend):**

```bash
cd backend
npm install
npm run dev
```

Backend akan berjalan di `http://localhost:5000`.

**Terminal 2 (Frontend):**

```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`.

---

## Cara Menggunakan Aplikasi (User Guide)

1. **Salin Tautan Playlist Publik Spotify:**
   - Buka Spotify, pilih playlist publik yang ingin dianalisis, lalu salin tautannya (format `https://open.spotify.com/playlist/...`).
   - Anda juga dapat menekan tombol **Pakai contoh link playlist** pada halaman awal untuk mencoba secara cepat.
2. **Pilih Jumlah Rekomendasi & Mulai Analisis:**
   - Pilih jumlah lagu rekomendasi (`10 lagu` atau `15 lagu`), lalu klik **Analyze Playlist**.
   - Selama proses berjalan, layar *Interactive Turntable Vinyl Loader* menampilkan perkembangan proses beserta kartu fakta musik **CATATAN KURATOR** yang dapat diklik untuk berganti fakta.
3. **Jelajahi Hasil pada Stage 3-Kolom:**
   - **Tab Top Bar (`Rekomendasi` vs `Kurang Cocok`):** Berpindah antara daftar lagu rekomendasi baru dan daftar lagu dari playlist asal yang terdeteksi kurang sesuai dengan suasana utama.
   - **Kolom Kiri (Vinyl Cover Showcase):** Menampilkan sampul album lagu terpilih beserta piringan hitam yang berputar halus saat preview audio diputar.
   - **Kolom Tengah (`Catatan AI` & `Lirik Lagu`):** Membaca alasan musikal AI atau deskripsi ketidaksesuaian lagu, membuka kartu **Ringkasan vibe playlist**, serta beralih ke tab **Lirik Lagu** untuk melihat lirik penuh atau lirik karaoke tersinkron.
   - **Kolom Kanan:** Daftar lagu bernomor dengan durasi `mm:ss`. Klik lagu mana pun untuk langsung mengganti tampilan vinyl dan detailnya.
4. **Putar Lagu di Dock Bawah:**
   - Gunakan tombol **Previous**, **Play/Pause**, **Next**, **Progress Scrubber**, dan **Volume Slider** untuk memutar preview audio 30 detik (otomatis lanjut ke lagu berikutnya saat selesai).
   - Klik **Full Track (Spotify)** jika ingin memutar lagu penuh melalui Spotify Embed Player langsung di dalam aplikasi (membutuhkan sesi login Spotify aktif di browser Anda).
   - Klik thumbnail sampul album di baris paling bawah untuk navigasi cepat antara lagu rekomendasi dan lagu playlist asal.
5. **Akses Riwayat Kurasi:**
   - Di halaman awal, klik salah satu kartu pada bagian **RIWAYAT KURASI TERAKHIR** untuk membuka kembali hasil sebelumnya secara instan, atau klik **Hapus Riwayat** untuk membersihkannya.
   - Di halaman hasil, klik tombol **Riwayat** di pojok kanan atas untuk membuka drawer samping dan berpindah antar playlist tersimpan.

---

## Daftar Endpoint API Backend

### `GET /api/health`

Memeriksa status kesiapan server backend.

**Contoh Respons (`200 OK`):**

```json
{
  "status": "ok",
  "service": "soundsense-backend"
}
```

### `POST /api/recommend`

Menganalisis playlist publik Spotify, menghasilkan rekomendasi lagu baru, dan mendeteksi lagu yang kurang selaras di playlist asal. Dibatasi maksimal 10 permintaan per menit per IP (`express-rate-limit`).

**Request Body:**

```json
{
  "playlistUrl": "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6",
  "limit": 10
}
```

- `playlistUrl` (wajib): URL playlist Spotify valid pada domain `open.spotify.com/playlist/{id}` (mendukung path lokal seperti `/intl-id/playlist/{id}`).
- `limit` (opsional, default `10`): Bilangan bulat antara `1` hingga `20`.

**Contoh Respons (`200 OK`):**

```json
{
  "playlistInfo": {
    "id": "37i9dQZF1DX4WYpdgoIcn6",
    "name": "Chill Hits",
    "description": "Kick back to the best new and recent chill hits.",
    "owner": "Spotify",
    "image": "https://image-cdn-ak.spotifycdn.com/image/...",
    "spotifyUrl": "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6",
    "totalTracks": 100,
    "analyzedTracks": 50
  },
  "vibeAnalysis": {
    "mood": "Melankolis Modern yang Intim",
    "genres": ["Indie Pop", "Contemporary R&B", "Bedroom Pop"],
    "summary": "Playlist ini didominasi aransemen minimalis dengan vokal intim dan tempo lambat hingga menengah."
  },
  "sourceTracks": [
    {
      "id": "6dOtVTDdiauQNBQEDOtlAB",
      "trackNumber": 1,
      "title": "BIRDS OF A FEATHER",
      "artist": "Billie Eilish",
      "album": "HIT ME HARD AND SOFT",
      "coverUrl": "https://i.scdn.co/image/...",
      "spotifyUrl": "https://open.spotify.com/track/6dOtVTDdiauQNBQEDOtlAB",
      "previewUrl": "https://p.scdn.co/mp3-preview/...",
      "releaseYear": 2024,
      "durationMs": 210373
    }
  ],
  "recommendations": [
    {
      "id": "1dEy9Pl81QopSxNsPxOkQy",
      "title": "Glue Song",
      "artist": "beabadoobee",
      "album": "Glue Song",
      "coverUrl": "https://i.scdn.co/image/...",
      "spotifyUrl": "https://open.spotify.com/track/1dEy9Pl81QopSxNsPxOkQy",
      "previewUrl": "https://audio-ssl.itunes.apple.com/...",
      "releaseYear": 2023,
      "durationMs": 135920,
      "reason": "Petikan gitar akustik lembut dan nuansa vokal intimnya selaras dengan karakter hangat playlist Anda."
    }
  ],
  "outliers": [
    {
      "id": "exampleTrackId",
      "trackNumber": 14,
      "title": "Contoh Lagu Kontras",
      "artist": "Nama Artis",
      "album": "Nama Album",
      "coverUrl": "https://i.scdn.co/image/...",
      "spotifyUrl": "https://open.spotify.com/track/...",
      "previewUrl": "https://p.scdn.co/mp3-preview/...",
      "releaseYear": 2023,
      "durationMs": 195000,
      "mismatchScore": 82,
      "reason": "Tempo perkusi yang terlalu agresif memutus suasana tenang yang mendominasi lagu lainnya."
    }
  ]
}
```

**Kode Status Error:**
- `400`: URL playlist tidak valid, `limit` di luar batas, format JSON rusak, atau playlist kosong.
- `404`: Playlist tidak ditemukan atau bersifat private.
- `429`: Melebihi batas 10 permintaan per menit.
- `502`: Kegagalan autentikasi atau koneksi ke Spotify API / Google Gemini API.

### `GET /api/lyrics`

Mengambil lirik tersinkron maupun teks penuh dari LRCLIB API dengan cache memori di backend.

**Query Parameter:**
- `title` (wajib): Judul lagu.
- `artist` (opsional): Nama artis.

**Contoh Permintaan:**

```text
GET /api/lyrics?title=Glue%20Song&artist=beabadoobee
```

**Contoh Respons (`200 OK`):**

```json
{
  "plainLyrics": "I've never known someone like you, ooh...",
  "syncedLyrics": "[00:12.38] I've never known someone like you, ooh\n[00:18.71] Tangled in love, stuck by you",
  "instrumental": false
}
```

Jika lagu bersifat instrumental atau lirik tidak ditemukan, endpoint tetap mengembalikan `200 OK` dengan `plainLyrics: null` dan `syncedLyrics: null`.

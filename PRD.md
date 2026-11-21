# Product Requirements Document (PRD): VibeMatch — AI Spotify Playlist Recommender

## 1. Ringkasan Produk
**VibeMatch** adalah aplikasi web berbasis AI yang menganalisis karakteristik musik, *mood*, dan genre dari sebuah tautan playlist publik Spotify, lalu memberikan rekomendasi lagu baru yang selaras beserta alasan personalisasinya.

## 2. Tech Stack
- **Frontend:** React (Vite) + Tailwind CSS + Lucide React (Icons).
- **Backend:** Node.js + Express.js (REST API untuk menyembunyikan API Key dari client).
- **Integrasi Eksternal:**
  - **Spotify Web API** (Client Credentials Flow untuk mengambil metadata playlist & mencari cover/link lagu rekomendasi).
  - **Google Gemini API** (`gemini-2.5-flash` dengan Structured JSON Output untuk menganalisis *vibe* dan merekomendasikan lagu).

## 3. Alur Kerja Pengguna (User Flow)
1. User membuka halaman utama dan menempelkan (*paste*) link playlist Spotify publik (contoh: `https://spotify.com...`).
2. User dapat memilih jumlah rekomendasi (misal: 10 atau 15 lagu) dan tingkat eksplorasi (*Mirip Banget* vs *Eksplorasi Baru*).
3. Sistem memvalidasi format URL, mengekstrak `playlist_id`, dan menampilkan status *loading* interaktif.
4. Backend mengambil maksimal 50 lagu pertama dari playlist tersebut via Spotify API.
5. Backend mengirimkan daftar judul lagu & artis ke Gemini AI untuk dianalisis *mood*-nya dan menghasilkan daftar rekomendasi lagu baru (yang tidak ada di playlist asal).
6. Backend mencocokkan setiap lagu rekomendasi AI ke Spotify Search API untuk mendapatkan *album cover*, *preview URL*, dan *external Spotify URL*.
7. Frontend menampilkan:
   - **Vibe Summary Card:** Ringkasan genre dominan, suasana hati (*mood*), dan deskripsi singkat karakter playlist user.
   - **Recommended Tracks List:** Daftar kartu lagu rekomendasi lengkap dengan cover album, artis, alasan kenapa cocok, tombol *play* (jika preview tersedia), dan tombol *"Buka di Spotify"*.

## 4. Spesifikasi API Backend (`POST /api/recommend`)
- **Request Body:**
  ```json
  {
    "playlistUrl": "https://spotify.com...",
    "limit": 10,
    "mode": "similar"
  }
  ```
- **Validasi & Keamanan:**
  - Wajib validasi regex URL Spotify (`open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)`).
  - Terapkan `express-rate-limit` (maksimal 10 request per menit per IP) untuk melindungi kuota API.
  - Tangani error spesifik: `400` (URL tidak valid), `404` (Playlist tidak ditemukan atau di-set Private), `502` (Gagal menghubungi Spotify/Gemini).
- **Response JSON:**
  ```json
  {
    "playlistInfo": {
      "name": "Nama Playlist Asal",
      "owner": "Nama Pembuat",
      "image": "https://...",
      "totalTracks": 42
    },
    "vibeAnalysis": {
      "mood": "Chill & Nostalgic Indie",
      "genres": ["Indie Pop", "Bedroom Pop", "Lo-Fi"],
      "summary": "Playlist ini didominasi tempo santai dengan nuansa melankolis hangat..."
    },
    "recommendations": [
      {
        "title": "Judul Lagu",
        "artist": "Nama Artis",
        "album": "Nama Album",
        "coverUrl": "https://...",
        "spotifyUrl": "https://spotify.com...",
        "reason": "Memiliki progresi gitar akustik yang mirip dengan lagu X di playlist kamu."
      }
    ]
  }
  ```

## 5. Struktur Folder Proyek
```text
vibematch/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── spotifyService.js   # Token caching, getPlaylistTracks, searchTrack
│   │   │   └── geminiService.js    # Prompting & JSON schema parsing
│   │   └── index.js                # Express server, CORS, rate limit, /api/recommend
│   ├── .env.example                # SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, GEMINI_API_KEY, FRONTEND_URL
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/             # UrlInputForm, VibeSummaryCard, TrackCard, SkeletonLoader
    │   ├── services/api.js         # Fetch wrapper ke backend
    │   └── App.jsx
    ├── .env.example                # VITE_API_BASE_URL
    └── package.json
```

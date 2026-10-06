<div align="center">

# 🔒 Cloaker

**Zero-Knowledge, Ephemeral Secret & File Sharing**  
Share sensitive passwords, API keys, `.env` files, and credentials with end-to-end encryption, self-destruct timers, and emergency revocation.

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![Upstash Redis](https://img.shields.io/badge/Upstash-Redis-00E599?style=for-the-badge&logo=redis)](https://upstash.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Why Cloaker?

Most "secret link" tools store your unencrypted notes on their servers or database. **Cloaker is different.**

Cloaker uses **in-browser AES-256-GCM encryption**. The decryption key stays exclusively in your URL hash (`#k=...`), which web browsers never send to the server. The server only ever sees scrambled ciphertext.

Even if our database is inspected, **nobody—not even Cloaker—can read your secrets.**

---

## ✨ Core Features

### 🛡️ True Zero-Knowledge Encryption
- **AES-256-GCM** client-side encryption powered by the native Web Crypto API.
- The decryption key lives only in the URL fragment (`#k=...`). It is never sent over HTTP, never logged in headers, and never stored in the database.
- **Universal Key Scrubbing:** Once unlocked in memory, the key fragment is automatically scrubbed from the recipient's browser address bar to prevent history or shoulder-surfing leaks.

### 📁 Encrypted File & Code Sharing (Up to 1.0 MB)
- Share sensitive files (`.env`, certificates, SSH keys, configs, PDFs, images).
- Includes drag-and-drop support, in-memory decryption, instant file download, and a responsive full-screen code viewer with line numbers.

### 🔐 Client-Side "Sent Vault" (Link History & Revocation)
- **Local-First History:** Automatically saves created link pointers on your device (`localStorage`).
- **Tab-Refresh Resilient:** Never lose your generated links or revocation capability if you accidentally refresh or close the tab.
- **100% Zero-Knowledge:** Plaintext secrets and file payloads are **never stored** locally.
- **Live Status Monitoring:** Safely check if a link is still active, burned, expired, or revoked without burning it.

### 🛑 Cryptographic Revocation Kill-Switch
- Senders receive an unguessable 24-byte revocation token upon link creation.
- Instantly wipe an active secret from the server at any time with constant-time (`crypto.timingSafeEqual`) authorization.

### 🔢 6-Digit Passcode Gate (3-Strike Defense)
- Protect high-value secrets with a 6-digit PIN.
- Verified using salted SHA-256 hashes.
- **Self-Destruct on 3 Failed Attempts:** Entering 3 incorrect passcodes permanently destroys the note and ciphertext on the server.

### ⏱️ Live Expiration Countdowns
- Choose your lifetime window: **5 Minutes**, **1 Hour**, **24 Hours**, or **7 Days**.
- Dynamic ticking countdown badges show exact time remaining across generator, passcode, and warning screens.
- Choose between **Burn on Read** (atomic destruction on first view) or **Reusable until Expiry**.

### 🔗 Multi-Link Generation
- Create 1 to 3 independent shareable links that reference a single encrypted master payload.
- Perfect for sending distinct one-time links to multiple recipients without duplicating ciphertext in storage.

### 🎴 Visual Share Cards & QR Codes
- Export beautiful, retina-quality **Share Cards** with stylized neon emerald QR codes.
- 1-click download as PNG or beam directly to nearby devices via the native Web Share API.

---

## 🔒 How It Works

```
[ Sender Browser ]
  │
  ├── 1. Generates random 256-bit AES-GCM key in memory.
  ├── 2. Encrypts plaintext or file into Ciphertext + IV.
  ├── 3. (Optional) Hashes 6-digit PIN with random cryptographic salt.
  │
  ▼ POST /api/secrets (Sends ONLY ciphertext, IV, and revocation hash)
[ Upstash Serverless Redis ]
  ├── Stores: Ciphertext & IV with automated TTL.
  ├── Stores: Link pointers and strike counter.
  │
  ▲ Shareable Link: https://cloaker.app/s/<linkId>#k=<encryptionKey>
  │                                                   │
  │                  (Fragment stays in browser, never sent to server)
  │
[ Recipient Browser ]
  ├── 1. Fetches metadata (non-destructively).
  ├── 2. (Optional) Solves 6-digit PIN challenge.
  ├── 3. Fetches ciphertext (atomically burned if single-use).
  ├── 4. Decrypts in-memory using #k= fragment.
  └── 5. Scrubs #k= from browser address bar for privacy.
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js `20.x` or later
- An [Upstash Redis](https://upstash.com) database (free serverless tier works great)

### 1. Clone & Install

```bash
git clone https://github.com/RahilMaiyani/Cloaker.git
cd Cloaker
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the project root:

```env
UPSTASH_REDIS_REST_URL="https://your-upstash-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_rest_token"
```

### 3. Run Locally

```bash
npm run dev
```

Open [`http://localhost:3000`](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Framework** | [Next.js 16.3](https://nextjs.org) (Turbopack, App Router) | React 19 server and client components |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Modern dark cyber glassmorphic theme |
| **Cryptography** | Web Crypto API | Client-side `AES-256-GCM`, `SHA-256`, `SubtleCrypto` |
| **Storage & Rate Limiting** | [Upstash Redis](https://upstash.com) | Ephemeral key-value storage with TTL and sliding-window rate limiting |
| **QR & Card Export** | `qr-code-styling` & `html-to-image` | High-resolution visual share badges |
| **Local Vault** | Web Storage API (`localStorage`) | Local-first zero-knowledge history management |
| **Icons** | [Lucide React](https://lucide.dev) | Crisp, modern icon set |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

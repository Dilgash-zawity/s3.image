# s3.image

A modern, high-performance image storage, processing, and management web application built with **Svelte 5**, **SvelteKit**, **Bun**, **S3 Object Storage**, **PostgreSQL**, and **Drizzle ORM**.

---

## Overview

**s3.image** provides an end-to-end solution for uploading, processing, storing, and serving images. Leveraging native capabilities of the **Bun** runtime (`Bun.S3Client` and `Bun.Image`) alongside SvelteKit's experimental **Remote Functions**, it delivers an ultra-fast developer and user experience without relying on bulky third-party cloud SDKs.

---

## Features

- ⚡ **Bun-Powered Storage & Processing**:
  - **Native S3 Client (`Bun.S3Client`)**: Zero-overhead interaction with any S3-compatible cloud storage (AWS S3, Cloudflare R2, MinIO, Tigris, Backblaze B2).
  - **Server-Side Thumbnail Generation (`Bun.Image`)**: Automatically extracts dimensions (`width`, `height`), format, and generates optimized 400×400 `.webp` thumbnails during upload.
- 🎨 **Svelte 5 Reactive UI**:
  - Built with Svelte 5 Runes (`$state`, `$derived`).
  - Drag-and-drop file upload zone with immediate local preview.
  - Interactive gallery grid with responsive image cards, format tags, and metadata badges.
  - Full-screen lightbox modal for high-resolution image inspection.
- 🔄 **SvelteKit Remote Functions (RPC)**:
  - Uses experimental `$app/server` `query` and `command` primitives (`#lib/images.remote.ts`).
  - Type-safe mutations that automatically invalidate and update local client state via `.updates(getImages)`.
- 🗄️ **Relational Metadata with PostgreSQL & Drizzle ORM**:
  - Fully typed database schema tracking S3 object keys, thumbnail keys, original dimensions, MIME types, file sizes, and timestamps.
- 🔒 **Type-Safe Validation with Valibot**:
  - Input schema validation on uploads and deletions to ensure data integrity before touching storage or the database.
- 🌐 **Direct Streaming & Download Endpoints**:
  - `/api/images/[id]`: Streams stored images directly from S3 with cache control headers.
  - `/api/images/[id]/download`: Streams image files with sanitized `Content-Disposition: attachment` headers for one-click downloading.
  - Secure, pre-signed 1-hour URLs for optimized CDN/direct access.

---

## Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | [Bun](https://bun.sh) | High-performance JavaScript runtime powering S3 calls & image operations |
| **Framework** | [SvelteKit](https://svelte.dev) + [Svelte 5](https://svelte.dev) | Modern frontend and server framework with Runes & Remote Functions |
| **Database** | [PostgreSQL](https://www.postgresql.org) | Relational database for image metadata |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) | TypeScript ORM for type-safe database queries and migrations |
| **Image Processing**| `Bun.Image` | Native server-side image resizing, metadata extraction, and WebP transcoding |
| **Object Storage** | `Bun.S3Client` / S3 API | Native S3 client for object uploads, deletions, streaming, and presigned URLs |
| **Validation** | [Valibot](https://valibot.dev) | Modular, type-safe schema validation |
| **Bundler** | [Vite](https://vite.dev) | Next-generation frontend build tooling |

---

## Project Structure

```text
.
├── src/
│   ├── env.ts                       # Environment variable schema (defineEnvVars)
│   ├── lib/
│   │   ├── images.remote.ts         # Remote queries & commands (upload, get, delete)
│   │   ├── index.ts                 # Library entry point (#lib alias)
│   │   └── server/
│   │       ├── db/
│   │       │   ├── index.ts         # Postgres & Drizzle client initialization
│   │       │   └── schema.ts        # Database schema (images table)
│   │       └── s3.ts                # Bun.S3Client instance & configuration
│   └── routes/
│       ├── +layout.svelte           # Root layout
│       ├── +page.svelte             # Main UI: gallery, drag-and-drop uploader, modal
│       └── api/
│           └── images/
│               └── [id]/
│                   ├── +server.ts          # Direct stream image route (GET)
│                   └── download/+server.ts # Direct download attachment route (GET)
├── drizzle.config.ts                # Drizzle Kit configuration
├── package.json                     # Project scripts and dependencies
├── tsconfig.json                    # TypeScript compiler configuration
└── vite.config.ts                   # Vite & SvelteKit configuration
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2.0 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) database instance
- S3-compatible Object Storage bucket (AWS S3, Cloudflare R2, MinIO, Tigris, etc.)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Dilgash-zawity/s3.image.git
cd s3.image
bun install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure your credentials in `.env`:

```ini
# PostgreSQL Connection
DATABASE_URL="postgres://user:password@localhost:5432/dbname"

# S3-Compatible Storage Credentials
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_BUCKET="your-bucket-name"
S3_ENDPOINT="https://s3.eu-central-1.amazonaws.com" # Or https://<account_id>.r2.cloudflarestorage.com, https://t3.storageapi.dev, etc.
S3_REGION="auto" # e.g. us-east-1, eu-central-1, ams, or auto
```

### 3. Initialize the Database

Push the schema to your PostgreSQL database using Drizzle Kit:

```bash
bun run db:push
```

*(Optional)* You can open **Drizzle Studio** in your browser to inspect database tables and records visually:

```bash
bun run db:studio
```

### 4. Start Development Server

```bash
bun run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Starts the Vite development server with Bun runtime |
| `bun run build` | Builds the SvelteKit application for production |
| `bun run preview` | Previews the production build locally |
| `bun run check` | Runs Svelte & TypeScript type checks (`svelte-check`) |
| `bun run check:watch` | Runs type checks in watch mode |
| `bun run db:push` | Pushes the Drizzle schema directly to the database |
| `bun run db:generate` | Generates Drizzle migration SQL files |
| `bun run db:migrate` | Runs existing Drizzle migrations against the database |
| `bun run db:studio` | Launches Drizzle Studio GUI for database inspection |

---

## API & Architecture Reference

### SvelteKit Remote Functions (`src/lib/images.remote.ts`)

The application utilizes SvelteKit's experimental Remote Functions for type-safe client-server interactions:

- **`getImages()` (`query`)**:
  - Queries all stored images ordered by creation date descending.
  - Generates 1-hour presigned viewing URLs for both original images and thumbnails using `s3.presign()`.
  - Attaches direct API streaming and download URLs.

- **`uploadImage({ name, mimeType, data })` (`command`)**:
  - Validates payload with Valibot schema (`UploadImageSchema`).
  - Decodes base64 buffer.
  - Extracts image dimensions and format via `Bun.Image`.
  - Creates a resized 400×400 `.webp` thumbnail and stores it at `thumbnails/<timestamp>-<uuid>.webp`.
  - Saves the full-resolution image to S3 at `images/<timestamp>-<uuid>.<ext>`.
  - Inserts a record in PostgreSQL with metadata and returns the created image object.

- **`deleteImage({ id })` (`command`)**:
  - Validates image ID with Valibot schema.
  - Deletes both original image file and thumbnail file from S3 bucket via `s3.delete()`.
  - Removes the database record in PostgreSQL via Drizzle.

### REST API Endpoints

- **`GET /api/images/[id]`**:
  - Fetches the image record from PostgreSQL.
  - Obtains `s3.file(record.s3Key)` and returns a direct streaming response (`s3File.stream()`).
  - Sends `Cache-Control: public, max-age=86400` for client/browser caching.

- **`GET /api/images/[id]/download`**:
  - Streams the file with `Content-Disposition: attachment; filename="<sanitized_name>"`.
  - Triggers a browser file download with the original image filename.

---

## License

MIT

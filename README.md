# WELZ Publisher

Local-first Content Operations & Publishing Automation Workspace.

## Overview

WELZ Publisher centralises content creation, platform-specific versioning, local media management, scheduling, automated queue execution, and complete operational history through modular platform integrations.

Data is stored locally in an embedded SQLite database; publishing executes over the network using official platform adapters and credential stores.

## Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │               Renderer (React)               │
                  │  Command · Compose · Content · Media         │
                  │  Calendar · Publishing · History · Platforms │
                  └───────────────────────┬──────────────────────┘
                                          │ Typed IPC
                                          ▼
                  ┌──────────────────────────────────────────────┐
                  │             Preload ContextBridge            │
                  └───────────────────────┬──────────────────────┘
                                          │ Safe IPC
                                          ▼
                  ┌──────────────────────────────────────────────┐
                  │                 Main Process                 │
                  │  ┌──────────────┐             ┌────────────┐ │
                  │  │ SafeStorage  │             │ SQLite DB  │ │
                  │  └──────┬───────┘             └─────┬──────┘ │
                  │         │                           │        │
                  │         ▼                           ▼        │
                  │  ┌──────────────┐             ┌────────────┐ │
                  │  │  Automation  │◄────────────┤ Repository │ │
                  │  │    Engine    │             └────────────┘ │
                  │  └──────┬───────┘                            │
                  │         │                                    │
                  │         ▼                                    │
                  │  ┌──────────────────────────┐                │
                  │  │ Platform AdapterRegistry │                │
                  │  └──────────┬───────────────┘                │
                  └─────────────┼────────────────────────────────┘
                                │ Official APIs / OAuth
                                ▼
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
    [ LinkedIn ]          [ Instagram ]          [ WhatsApp ]
```

## Core Principles

1. **Local-first**: Master content, platform variants, media metadata, schedules, jobs, and history live on your local machine in SQLite.
2. **User-controlled**: AI assists; the user reviews, edits, and approves. No content is silently altered or published without consent.
3. **Modular Platform Adapters**: Zero platform-specific spaghetti code in the core engine. Each destination is an isolated adapter with explicit validation and publishing contracts.
4. **Reliable State Machine**: All publishing actions are tracked as jobs: `draft` → `ready` → `queued` → `uploading` → `publishing` → `published` (or `failed`, `retrying`).
5. **Honest Boundaries**: No fake API claims. Actions succeed only with real platform responses. Simulated testing in Development mode is prominently labelled `SIMULATED`.

## Tech Stack

- **Desktop Shell**: Electron 34 (`contextIsolation: true`, sandboxed renderer)
- **Frontend UI**: React 19 + TypeScript + Vite
- **State Management**: Zustand
- **Database**: SQLite (`node:sqlite` DatabaseSync, WAL mode, foreign keys enabled)
- **Schema Validation**: Zod
- **Build & Packaging**: `electron-vite`, `tsc`

## Project Structure

```text
welz-publisher/
├── apps/
│   └── desktop/
│       ├── main/              # Main process, secure storage, IPC handlers
│       ├── preload/           # Typed IPC bridge & context isolation
│       └── renderer/          # React application, components, pages, design system
├── packages/
│   ├── shared/                # Types, schemas, constants, status helpers
│   ├── database/              # SQLite database wrapper, schema, repository, tests
│   ├── platform-core/         # PlatformAdapter interface, LinkedIn/IG/WhatsApp adapters
│   ├── automation/            # Automation engine, queue worker, retry policy
│   └── scheduler/             # Due schedule detection & timing helpers
├── package.json
└── tsconfig.base.json
```

## Features

### 1. Command Dashboard
- High-level content metric counters (Drafts, Ready, Scheduled, Publishing, Published, Failed).
- Recent activity feed with status badges and simulation indicators.
- Upcoming scheduled items with localized time display.
- Automation engine status pill (Ready, Running, Paused, Attention required).

### 2. Content Composer
- Master content creation with live word and character counters.
- Built-in AI Assistant toolbar (Professionalise, Shorten, Fix Grammar, Add Hashtags).
- Media attachment with upload and removal support.
- Multi-destination account selection.
- Platform-specific variant preparation:
  - **LinkedIn**: formatted for professional engagement with character limits.
  - **Instagram**: hook + caption with automated hashtag formatters.
  - **WhatsApp**: formatted announcement structure with bolding and bullet points.
- Side-by-side representational platform preview (Master, LinkedIn, Instagram, WhatsApp).
- Review and Approve workflow before publishing or scheduling.

### 3. Content Library
- Filter by post status (`All`, `Drafts`, `Ready`, `Scheduled`, `Publishing`, `Published`, `Failed`).
- Instant search by title, master content, or destination account.
- Deep detail view showing master post, platform variants, media attachments, and history.

### 4. Media Library
- Category organization (`Brand`, `Events`, `Social`, `Projects`, `General`).
- Grid and list views.
- Post usage counter per media item.
- File upload, deletion, and renaming.

### 5. Publishing Calendar
- Month and Week views for scheduled publications.
- Color-coded date cells with event links directly to post detail.

### 6. Publishing Center
- Active jobs monitor (`uploading`, `publishing`, `retrying`).
- Scheduled queue with publication countdown.
- Failed job inspection with actionable error messages, Reconnect shortcuts, and one-click Retry.
- Automation engine pause/resume controls.

### 7. Platforms & Credentials
- Account status tracking for LinkedIn, Instagram, and WhatsApp.
- Connect, Reconnect, and Disconnect actions.
- Secure OS credential storage using Electron `safeStorage` (tokens never exposed to renderer).

### 8. Audit History
- Complete log of all past publishing operations.
- Preserves timestamp, platform, account, external ID, status, and error details.
- Development mode executions are explicitly marked `SIMULATED`.

## Platform Integrations

| Platform  | Official API Requirement | Status |
|-----------|--------------------------|--------|
| LinkedIn  | LinkedIn REST API (`w_member_social`, `w_organization_social`) | Adapter configured; OAuth credential boundary |
| Instagram | Meta Graph Content Publishing API | Adapter configured; Meta Business Account boundary |
| WhatsApp  | WhatsApp Cloud Platform API | Adapter configured; Cloud API Phone Number ID boundary |

## Local Setup & Development

```bash
# 1. Install dependencies
npm install

# 2. Build shared packages
npm run build

# 3. Run typecheck across all workspaces
npm run typecheck

# 4. Run database & repository test suite
npm run test

# 5. Start desktop application in development mode
npm run dev
```

## Production Build

```bash
npm run build
```
#   m u l t i p o s t  
 #   m u l t i p o s t  
 
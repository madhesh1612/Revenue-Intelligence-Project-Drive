# Revenue Inbox

Revenue Inbox is a modern React + TypeScript dashboard for reviewing inbound call and meeting activity, routing conversations to business categories, tracking review status, and exporting clean reporting data for sales and revenue operations teams.

This project was designed to help a SpendNest-style team process incoming conversation records from CRM-like vendor exports, classify them intelligently, and keep a human-review workflow for ambiguous cases.

---

## Overview

The application gives teams a single workspace to:

- import JSON-based call and meeting batches
- review transcript-backed records
- classify records into routing categories
- monitor priority and review state
- export filtered data and manifest summaries
- persist data locally in the browser across refreshes

It is a front-end prototype with no backend service. All state is stored in browser localStorage and is intended to simulate a working operational workflow for internal reporting.

---

## Key Features

### 1. Dashboard analytics
The dashboard summarizes:

- total imported records
- calls vs meetings
- transcript coverage
- connected call rates
- high-priority records
- route distribution
- rep activity trends

This gives operational managers a quick summary of incoming sales and support activity.

### 2. Inbox review workflow
The inbox page presents imported records as queue items. Users can:

- browse records
- filter by route or review state
- open a full conversation detail view
- select individual records for deeper review

### 3. Conversation detail view
Each conversation includes:

- source metadata
- transcript details
- route decision
- confidence and evidence excerpt
- review history
- manual override controls
- mark-as-reviewed actions

This is where the analysis and human review funnel lives.

### 4. Routing engine
The routing engine classifies records into categories such as:

- prospect_follow_up
- partner_opportunity
- customer_success
- internal_operations
- vendor_supplier
- no_connection
- no_transcript
- human_review_needed

The logic is deterministic and transcript-first, which means the transcript content is treated as the strongest evidence signal.

### 5. Manual override and review tracking
Users can override the automated recommendation and preserve the override history. Each change is recorded with:

- timestamp
- actor
- note
- previous route
- new route

This gives the workflow auditability.

### 6. Import engine
The app supports ingesting batches of records from a source export with a revision system. It handles:

- new records
- updates to existing records
- idempotent same/revision skipping
- stale route detection when transcript text changes
- import batch history tracking

### 7. Export engine
The app can generate export manifests and summaries for downstream reporting or manager handoff.

Typical export output includes:

- source metadata
- route category
- all route candidates
- review status
- manual override flag
- analysis freshness
- activity date

### 8. Local persistence
The app saves its state in localStorage under a dedicated key. This makes it easy to:

- keep data across refreshes
- simulate a realistic import/review workflow in a browser
- avoid a separate backend while testing the user experience

---

## Project Structure

```text
revenue-inbox/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── .gitignore
├── README.md
├── public/
├── dist/
├── node_modules/
├── src/
│   ├── App.tsx
│   ├── counter.ts
│   ├── exportEngine.ts
│   ├── importEngine.ts
│   ├── index.css
│   ├── main.ts
│   ├── main.tsx
│   ├── metrics.ts
│   ├── routing.ts
│   ├── style.css
│   ├── types.ts
│   ├── vite-env.d.ts
│   ├── assets/
│   │   ├── hero.png
│   │   ├── typescript.svg
│   │   └── vite.svg
│   └── pages/
│       ├── ConversationDetail.tsx
│       ├── Dashboard.tsx
│       ├── Export.tsx
│       ├── Import.tsx
│       ├── Inbox.tsx
│       └── Routing.tsx
└── package-lock.json
```

### Root-level files

#### index.html
The HTML entrypoint for the application. It loads the root React application from `/src/main.tsx`.

#### package.json
Defines dependencies and scripts:

- `npm install` to install dependencies
- `npm run dev` to start the app locally
- `npm run build` to produce a production build
- `npm run preview` to preview the production bundle

#### vite.config.ts
Vite configuration for the development environment and bundling settings.

#### tsconfig.json
TypeScript compiler settings for the project.

#### tailwind.config.js and postcss.config.js
Styling configuration for Tailwind and PostCSS support.

#### public/
Contains static public assets that are served directly by Vite.

#### dist/
Generated production build output after running `npm run build`.

---

## src folder breakdown

### App.tsx
The main application shell. This file:

- manages the current page
- manages selected record state
- keeps the sidebar navigation in sync
- orchestrates events like import, override, review, and reset
- renders the correct page based on current state

### types.ts
Defines the source and application data contracts. This is the data model for everything in the app, including:

- call payloads
- meeting payloads
- source records
- route categories
- review statuses
- processed records
- app state
- dashboard metrics
- export manifest shapes

### importEngine.ts
The import and state-management engine. It is the backbone for the app’s data lifespan and handles:

- loading/saving state
- processing new imports
- updating records across revisions
- preserving manual overrides
- marking stale analysis
- reset logic
- import batch bookkeeping

### routing.ts
The classification engine that reads call and meeting transcript content and decides the best route category. It uses keyword-driven rules and transcript-first logic, with a fallback to `human_review_needed` for ambiguous records.

### exportEngine.ts
Generates export artifacts and manifests used by operations or downstream automation.

### metrics.ts
Likely houses analytics helpers used to compute summaries and report metrics.

### pages/
This folder contains the feature pages:

- `Dashboard.tsx` — summary analytics
- `Inbox.tsx` — record queue
- `Routing.tsx` — route and review-focused analysis
- `Import.tsx` — import interface
- `Export.tsx` — export interface
- `ConversationDetail.tsx` — individual record review screen

### assets/
Static images used by earlier scaffold or branding touches.

---

## Data model

The app works around two major data layers:

### 1. Source records
These are the raw imported records from external exports:

- `call`: call metadata and transcript payload
- `meeting`: meeting metadata and transcript payload

### 2. Processed records
Source data is processed into a normalized model with derived metadata, including:

- `source_type`
- `source_id`
- `record_ref`
- `route`
- `review_status`
- `priority`
- `review_history`
- `activity_date_ist`
- `first_imported_at`
- `last_updated_at`

This normalized model allows the app to do auditing, monitoring, and manager review cleanly.

---

## Routing categories

The app is built around these route categories:

- `prospect_follow_up` — active prospect discussion or intentional sales follow-up
- `partner_opportunity` — partnership, referrer, or co-selling conversation
- `customer_success` — support, migration, account onboarding, or in-life issue resolution
- `internal_operations` — internal SpendNest activities or team ops work
- `vendor_supplier` — supplier evaluation or commercial review
- `no_connection` — background or non-substantive call with no usable transcript
- `no_transcript` — record missing usable text or transcript
- `human_review_needed` — ambiguous or edge-case classification

---

## Review lifecycle

A record in this app generally moves through the following stages:

1. Imported into the state store
2. Auto-routed based on transcript heuristics
3. Listed in the Inbox or Dashboard
4. Reviewed by a manager or operations user
5. Overridden or confirmed manually if needed
6. Marked reviewed when the action is complete
7. Exported for downstream reporting

---

## Setup and usage

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run the app in development mode

```bash
npm run dev
```

By default, Vite serves the app on a local dev port such as:

```text
http://localhost:5173
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

---

## Notes on implementation

- The app is a client-side React front end; there is no backend database.
- Data is stored in `localStorage` for interactive testing and demonstration.
- Import logic supports revisions so newer exports can overwrite older ones safely.
- Routing logic weighs transcript evidence first and avoids overtrusting metadata-only signals.
- The project intentionally keeps logic in a few clear modules so routing, import, and exports remain easy to reason about.

---

## Example workflows

### Workflow 1: Import and review
1. Import a new batch of call/meeting records.
2. View the dashboard metrics.
3. Open the Inbox.
4. Review each record and its transcript evidence.
5. Mark as reviewed when complete.

### Workflow 2: Route override
1. Open a conversation that the automation classified incorrectly.
2. Choose a different route.
3. Add a note to explain the reasoning.
4. Save the override.
5. The route history records the manual change.

### Workflow 3: Export reporting
1. Open the export page.
2. Generate summary data.
3. Deliver the manifest to team or downstream systems.

---

## Good contributors checklist

When changing the app, keep the following in mind:

- preserve the source record model and types
- keep routing logic deterministic and explainable
- maintain review history for operator actions
- avoid unnecessary backend dependencies for a front-end demo
- verify TypeScript and build health before merging changes

---

## Summary

Revenue Inbox is a structured front-end operations workspace for reviewing sales and conversation activity, assigning business routes, tracking review status, and generating exports. It is designed to be easy to understand, auditable, and operationally useful without requiring a backend service.

If you are working on this project, the most important files to understand first are:

- [src/App.tsx](src/App.tsx)
- [src/importEngine.ts](src/importEngine.ts)
- [src/routing.ts](src/routing.ts)
- [src/types.ts](src/types.ts)
- [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)
- [src/pages/Inbox.tsx](src/pages/Inbox.tsx)
- [src/pages/ConversationDetail.tsx](src/pages/ConversationDetail.tsx)

These files represent the heart of the app’s workflow.

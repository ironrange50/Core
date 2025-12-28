# 1. Prepare the Z620 host

1. Install a clean OS (Windows 10 Pro as listed, or preferably a minimal Linux server if you decide to dual‑boot or reimage). [4]
2. Update BIOS and firmware, enable virtualization, and verify all 6 cores / 12 threads and 16 GB RAM are recognized. [4]
3. Install system packages: 
   - Node.js 20.x (LTS) 
   - PostgreSQL 16.x 
   - Redis server 
   - Git, 7‑Zip (for archive handling), and a C++ build toolchain for native modules. [1][2]
4. Create OS‑level users and folders: 
   - One non‑admin user that will own the NeuroCore processes. 
   - Directories for `/opt/neurocore` (code), `/opt/neurocore/uploads`, `/opt/neurocore/logs`, `/opt/neurocore/backups`. [1][2]

***

## 2. Move codebase and configure environment

5. From your dev environment, export the full repo using the codebase export API (`full-repo-7z` or equivalent) and copy to the Z620. [1]
6. Extract the archive into `/opt/neurocore`, preserving the structure (server, src, drizzle, etc.). [1][2]
7. On the Z620, run `npm install` in the project root and confirm `package.json` matches the backed‑up version. [2]
8. Create environment configuration: 
   - Use `.replit` as the canonical list of env vars (AI model IDs, database URL, Aiven cert path, feature flags like `USEBRAINAI`, `USEHEARTAI`). 
   - Mirror these into a `.env` or systemd environment override: DB connection string, Redis URL, AI provider base URLs, all API keys. [1][2]
9. Place the Aiven SSL cert (if you keep that remote DB) or configure local Postgres with matching connection string as in `drizzle.config.ts`. [2][3]

***

## 3. Initialize and validate the database

10. Create a fresh Postgres database (e.g., `neurocore_prod`) and a dedicated DB user with full rights on it. [3]
11. Set `DATABASEURL` to point to this DB and run the Drizzle push/migrations command (`npm run dbpush` or the equivalent CLI sequence). [1][2]
12. Verify that: 
    - All unified memory, curiosity, repair, logs, sessions, messages, file pipeline, printer, vector, and P3 chat tables exist (67+ tables). 
    - Indexes such as `idxunifieduserid`, `idxcuriositystatus`, `idxrepairstatus`, and pgvector extension are present. [5][3]
13. If you are importing existing data, restore from your current instance via the Instance Migration Wizard or DB dump, then re‑run migrations to align schema. [5][1][3]

***

## 4. Bring services online on the Z620

14. Start Redis and ensure it is reachable at the host/port configured in the job queue code. [1][2]
15. Start the backend API server using the configured entry (e.g., `npm run server`) and confirm it binds on port 3001 as in `vite.config.ts` and `.replit`. [6][2]
16. Start the frontend dev server (`npm run dev`) and check that the Vite proxy correctly forwards `/api` to the backend without 503 proxy errors. [2]
17. Hit core health and status endpoints from a browser or curl: 
    - `/api/health` 
    - `/api/brain-ai/status` and `/api/heart-ai/status` 
    - `/api/maintenance/status`, `/api/maintenance/auto-heal/status` 
    - `/metrics` (Prometheus text) if exposed as in the metrics registry. [6][1]

***

## 5. Validate AI orchestration end‑to‑end

18. Confirm all AI provider keys are valid by firing: 
    - Triple AI endpoint (`/api/triple-ai`) with a simple mechanical/chemistry prompt. 
    - Brain AI and Heart AI status + one real request using their routes. [6][1][2]
19. For each path (P1, P2, P3), trigger requests and verify: 
    - Coherence metrics are returned. 
    - Fallback to backup model works when you temporarily invalidate a primary key. [6][2]
20. Exercise domain routing (Iracore domains, System/Knowledge domains) and ensure domain IDs used at runtime exist in `domainsregistry` and in the database entanglement tables. [6][5][3]
21. Confirm curiosity hooks: 
    - Low‑coherence responses create entries in `curiositytasks`. 
    - `engineRunner` / curiosity job runs pick them up and mark completed/failed. [4][6][3]

***

## 6. Memory, learning, and retrieval checks

22. Conduct a short synthetic session and inspect: 
    - `unifiedmemory` entries with raw/cleaned prompts, responses, device class, and health snapshots. 
    - `snapshotevents` rows for important events and their compression levels. [4][5][3]
23. Confirm memory‑spotter extraction populates `userprofiles` with communication style, traits, and interests after a few interactions. [4][3]
24. Verify semantic cache: send the same query twice and check for a second‑call cache hit in `semanticcache` with valid TTL. [5][3]
25. If you are enabling the P3 retrieval system: 
    - Ensure pgvector extension is active. 
    - Run one ingestion path that persists `embeddings` linked to `chatmessages`. 
    - Confirm that a retrieval query actually pulls from `embeddings` instead of only live provider calls. [3]

***

## 7. Observability, auto‑heal, and maintenance

26. Check that the metrics registry is emitting counters for HTTP requests, durations, auto‑heal runs, and curiosity tasks and that `/metrics` is wired. [4][6]
27. Start the auto‑heal scheduler and maintenance orchestrator, then: 
    - Manually trigger `/api/maintenance/run` and confirm snapshot creation, cleanup, and logs in `compressionsnapshots` and `systemevents`. 
    - Confirm auto‑heal thresholds (CPU, memory, error rate) are set to sane values for the Z620 and write a short stress test to see an auto‑heal cycle run. [5][1][3]
28. Validate maintenance API surface from the Admin UI: status, snapshot list, snapshot deletion, storage stats, auto‑heal start/stop/status screens. [5][1]

***

## 8. Security, auth, and multi‑tenant behavior

29. Create baseline users via the API or admin UI: at least one Admin, one Creator, one standard user. [5][3]
30. Verify JWT login, expiration, sessions table behavior, and account lockout logic by repeated bad logins. [5][3]
31. Confirm security middleware is active by attempting: 
    - Oversized bodies (request size limiter). 
    - Suspicious query parameters (HPP). 
    - Bad content types and CORS from disallowed origins. [6][5][1]
32. Turn on multi‑tenant RBAC (Phase 2): create organizations, assign users to orgs, create API keys, and verify routes enforce org boundaries and log to `auditlogs`. [5][1][3]

***

## 9. File ingestion, CAD, printers, and jobs

33. Upload test files through the UI: CAD (STEP/STL/OBJ), PDFs, and images, and confirm they flow through: 
    - `fileuploads`, `processingqueue`, `cadconversions`, `textextractions`, `imageextractions`. [4][5][3]
34. Validate OpenCASCADE geometry extraction and the Admin CAD status panel: search by CAD file ID, verify dimensions, volume, and cache clear operations. [4][5][3]
35. Run device discovery on the Z620’s network and confirm discovered printers land in `printerdevices` and show in the UI. [4][6][3]
36. Submit a print job from a blueprint and track it from `printjobs` through the websockets‑driven UI updates until completion/failure; verify error handling. [4][5][3]

***

## 10. Knowledge spaces, workflows, and integrations

37. Stand up Knowledge Spaces: 
    - Create a test space, upload documents, ensure they’re chunked and embedded into the right tables. 
    - Run search/answer flows over that corpus. [1][3]
38. Define a simple workflow (few steps, some external calls), execute it, and confirm entries in `workflows` and `workflowexecutions` with status transitions. [1][3]
39. Register a webhook endpoint and verify events (e.g., blueprint created, print job completed, repair request resolved) are posted and logged. [1][3]

***

## 11. Creator tools, self‑mod, and admin intelligence

40. From the Creator System AI UI, run a full loop on a non‑critical module: analyze → propose change → preview patch → approve or reject → rollback. Ensure records in `selfmodproposals` and `repairrequests` line up. [6][1][3]
41. Confirm Admin AI assistant, AI weights monitor, curiosity admin, and Iracore dashboard load correctly and respond to queries backed by real metrics and DB data, not placeholders. [4][5][1]

***

## 12. Productionization and runbooks

42. Wrap backend and frontend in systemd services (or equivalent) so they auto‑start on boot and restart on failure. [2]
43. Verify graceful shutdown path closes queues, runs final auto‑heal fast path, and closes the DB pool cleanly (no “pool leaking” errors). [4][6]
44. Configure rotating logs (Pino + OS log rotation) and confirm max size and retention match what the Z620 disk can handle. [4][1]
45. Write and store two short runbooks in your repo: 
    - “Normal operations” (start/stop, deploy, backup/restore). 
    - “Emergency” (DB or AI provider outage, auto‑heal failure, disk full).  
# Atomic commit ledger

Base `origin/dev` được fetch trước triển khai tại `dcbb814141bef3ed547f0893edb701c4d9407771`. Nhánh `feat/advanced-3d-asset-pipeline`.

| SHA | Commit | Verification |
| --- | --- | --- |
| `6b23a47` | `docs(assets): plan conservative 3D asset pipeline` | Source audit, architecture và contracts |
| `6c289c1` | `feat(assets): generate validated Draco LOD and WebP candidates` | Package 17/17, native roundtrip, APNG/quality/immutability/concurrency |
| `2e854a9` | `feat(museum): share validated self-hosted Draco decoding` | Unit, Public WASM/JS, CMS, integrity/abort/decoder failures |
| `0b1fcf8` | `feat(museum): select and retain bounded screen-space LOD assets` | Screen selection, cache/refcount, original fallback, browser picking/hotspots |
| `0cb26d3` | `test(assets): exercise browser decoding LOD and visual comparisons` | Asset cases, CMS WebP bổ sung, 51 production regressions, lint |
| `ed8f0e1` | `test(museum): exercise native corrupt Draco failure` | Native malformed stream từ chối an toàn qua browser, checksum hợp lệ |
| `d115a0b` | `docs(assets): deliver measured pipeline evidence and review checkpoints` | Benchmark manifests, raw logs và visual comparison |
| `4388274` | `merge(dev): integrate Gallery Slots with asset LOD lifecycle` | 383 units, 7 dev asset cases, production 24/26 và stock-dev proof cho hai failures |
| `12155b1` | Merge `origin/dev` tại `2a245d0` | Backend publish guard PR #185, frontend giống `4388274` |

Commit bổ sung evidence sau đồng bộ có message `docs(assets): record integrated Gallery Slots verification`. SHA cuối được hiển thị ở PR head và phản hồi bàn giao. Dùng `git log --first-parent dcbb814..HEAD --oneline` để đọc ledger của task.

PR draft #186 có base `dev`, head `feat/advanced-3d-asset-pipeline`. Trạng thái tích hợp đang chờ human review. Các checkpoint gồm hai Gallery Slots failures đã tái hiện trên stock dev, curator fidelity trên dataset có quyền, backend/database contract original/derived và hardware performance theo audit 261104. [Pull request #186](https://github.com/ailabs26/ailabs-museum/pull/186)

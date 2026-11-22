# Test plan

Unit: Unicode/Vietnamese normalization, ranking, deterministic ties, duplicate fields, literal regex characters, multi-term queries, empty/no-match, published room mapping, locale and refresh/removal. Existing guided geometry unit tests plus search trajectory test validate safe segments, room limits and real destination.

Browser mocked public API + existing renderer/XR probes: E01–E04 search/ranking/no network/highlights/clear; E05–E07 actual arrival, obstacle detour segments and rapid/repeated targets; E08 tour pause/dwell; E09 hotspot takeover; E10 input/WASD/Enter/Escape; E11 touch 390×844/no overflow/control bounds; E12 reduced motion; E13 GLB failure/blocked/context/room/exit; E14 existing navigation/camera/guided/hotspots/XR/fullscreen/fallback/Collection.

Performance: index/query benchmark on many exhibits (record actual duration, no absolute hardware claim); model request counts unchanged across queries; demand loop idle; unmount probe weak references/resource behavior. Screenshots and trace only where useful. Software WebGL is not real GPU/headset proof.

Required gates from front-end: npm run typecheck, npm run lint, npm run test:unit, npm run build; production preview Playwright affected suites. Record every failure/skip and justified rerun.

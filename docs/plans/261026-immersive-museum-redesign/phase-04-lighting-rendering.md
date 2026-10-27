# Phase 04 — Lighting and rendering

## Goal / scope
Balanced exhibition lighting, visual grounding and consistent physically based materials without postprocessing.

## Files
MuseumLighting, MuseumScene, MuseumRoom, ExhibitionDisplay, ArtifactModel; renderer-quality helper if required by phase 05.

## Steps / dependencies
- [x] After phase 03, add renderer probe assertions for color space, tone mapping, shadow budget and shadow receivers/casters.
- [x] Retain ACES tone mapping and explicit sRGB output; tune exposure against pale stone and bronze, avoid excessive emissive effects.
- [x] Balance hemisphere/ambient with warm overhead and cool neutral fill; use a bounded set of exhibition lights, never one light per CMS item.
- [x] One soft shadow-casting light with tight room shadow frustum and bounded 512/1024 maps. Floor/plinths receive; real GLB instance meshes and fallback geometry cast without modifying shared model assets.
- [x] Use a soft authored contact texture under plinths instead of hard flat contact disks. Avoid reflection/postprocessing pass cost and XR incompatibility.
- [x] Run render/model/recovery tests and visual review; review and commit.

## Risks / mitigation
Shadow acne: small bias/normalBias, soft PCF filtering; shimmering/overdraw: capped map sizes and only one caster light. Shadow costs must be measured; low tier retains contact grounding without shadow map.

## Acceptance / tests
Visible grounding, readable highlights, neutral ivory with warm accents, bounded dynamic lights and shadow maps. Real model material/normalization tests remain green; inspect close-up plus opening view.

## Commit
`feat(scene): add balanced exhibition lighting and soft shadows`.

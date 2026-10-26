# Aura gallery surfaces

Original procedural artwork authored for this repository (2026-10-26), released under CC0-1.0. No external photographs, scans, brands or historical depictions. Source/generator: `front-end/scripts/generate-gallery-textures.py` (seed 261026). Rebuild with Python + Pillow + numpy; these packages are authoring tools only.

Eight 512 × 512 PNGs: limestone color/roughness/tangent normal, lime plaster color/tangent normal, walnut color/tangent normal, and transparent radial contact occlusion. All are seamless except the intentionally edge-transparent contact patch. Color maps use sRGB; roughness/normal/alpha use linear data. At RGBA8 with mipmaps, eight resident textures require approximately 10.7 MiB; no unbounded cache. One room-level owner disposes textures/materials. Anisotropy is device-capped; no image exceeds 512 pixels. Stone repeats 4 × 4 across the floor; walnut repeats in the grain direction. No hotlinks or external texture requests.

CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

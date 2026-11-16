# Offline asset candidates

Node 22 or newer is required. Run from `tools/asset-pipeline`.

```powershell
npm ci
npm test
npm run fixture -- evidence/synthetic
npm run optimize -- --source evidence/synthetic/original.glb --output evidence/synthetic/draco
npm run optimize -- --source evidence/synthetic/source.png --output evidence/synthetic/image --image-policy detail
npm run benchmark
```

The source must be an immutable regular master file. Choose a fresh output directory with an existing parent. Each successful GLB run emits separate `lod0.glb`, `lod1.glb`, `lod2.glb` candidates when supported, plus `manifest.json`. Some assets retain LOD0 with `LOD_NOT_GENERATED` for lower levels. A standalone image emits `image.webp`, or an unchanged `image-original.*` fallback when conversion is larger or fails a quality comparison. Every artifact requires human visual review and the manifest always has `publicationEligible` set to `false`.

The tool reads bytes before trusting extensions. It validates GLB structure, embedded resources, hierarchy, bounded geometry counts, and the Khronos glTF specification before NodeIO. Unknown extensions, pre-compressed input, skinning, morph targets, animation, cameras and sparse accessors produce an `UNSUPPORTED` manifest. External resources and invalid content fail with no output. Transparent, double-sided, open or non-manifold surfaces receive LOD0 only. Thin features in closed meshes still require human inspection.

Draco uses position quantization 20 bits and normal/UV/color/generic quantization 16 bits. LOD0 keeps triangles without simplification. LOD1 and LOD2 use conservative candidate targets, locked borders, source-preserving vertex attributes, decoded bounds and bidirectional sampled surface-distance checks. A target ratio can remain unmet when the error bound constrains simplification.

Per-model candidate settings can be supplied through `--config model.json`.

```json
{
  "lod": [
    { "ratio": 0.8, "error": 0.0005 },
    { "ratio": 0.5, "error": 0.001 }
  ],
  "boundsTolerance": 0.005,
  "surfaceTolerance": 0.005,
  "embeddedWebp": false,
  "imagePolicy": "detail"
}
```

`photo` uses quality-95 lossy WebP only for JPEG without alpha and requires a measured PSNR of at least 38 dB for a candidate. `detail`, `data`, alpha and PNG use lossless encoding with exact decoded-pixel checks. Images retain their dimensions and orientation is applied without cropping. Animated, ICC-profiled, CMYK and high-bit-depth images return `UNSUPPORTED` for manual review. Original EXIF, authorship and licensing metadata remain in the immutable original. The manifest traces its name and SHA-256. Rights metadata must remain attached when a reviewed derivative is later published.

`--embedded-webp` opts into lossless, smaller-only conversion of unprofiled 8-bit PNG textures. It compares decoded pixels, preserves bindings and sampler settings, and requires `EXT_texture_webp`. JPEG and unsupported texture cases keep their source bytes. The source GLB remains available as the compatibility fallback. This package generates review candidates on local disk.

Output creation uses a temporary sibling directory, an exclusive cooperative lock, a final source-checksum check and an atomic directory rename. Existing output paths are refused. Caught failures remove temporary files. A force-killed process may leave its temporary directory and lock for manual inspection. Keep each processing directory owned by the invoking operator to prevent other processes from changing paths during the run.

The deterministic manifest records source and artifact SHA-256, exact sizes, scene/material/transform identity, bounds, triangles, vertices, texture sizes, geometric and retained-attribute error measurements, effective config and tool/native versions. Khronos Validator reports an informational unsupported-extension message for Draco and leaves its payload to the actual Draco decode and geometry/attribute checks. Sampled distance gives an approximation. Human comparisons must inspect silhouette, small inscriptions, materials, hotspot alignment and transitions. The benchmark emits real synthetic measurements under `.tmp/benchmark-*/benchmark.json` and labels application/device metrics unavailable.

Exit code `0` means candidates were generated. Exit code `2` means the source is unsupported. Exit code `1` reports input/configuration/processing failure.

# ComfyUI Node Archetypes & Common Extensions

## 1. Core Conditioning Nodes

- **`CLIPTextEncode`**: Text prompt tokenizer and encoder.
  - Input: `clip` (`CLIP`), `text` (`STRING`).
  - Output: `CONDITIONING`.
- **`ConditioningCombine`**: Blends two conditioning tensors together without interpolation weights.
- **`ConditioningSetArea`**: Applies conditioning strictly to a bounding box sub-area in latent space (useful for multi-subject compositions).
- **`FluxGuidance`**: Supplies cfg-like guidance values for Flux models (often replacing standard CFG scale).

## 2. Model & Adapter Nodes

- **`CheckpointLoaderSimple`**: Loads monolithic model safetensors or ckpt files.
- **`UNETLoader`**: Loads standalone diffusion models (used extensively with SD3 and Flux).
- **`DualCLIPLoader`**: Loads two CLIP models simultaneously (e.g. `clip_l` + `t5xxl`).
- **`VAELoader`**: Loads external fine-tuned VAEs (e.g., `sdxl_vae.safetensors`, `ae.safetensors`).
- **`LoraLoader`**: Injects low-rank adaptation weights into UNet/Transformer and CLIP text encoder.
  - Inputs: `model`, `clip`, `lora_name`, `strength_model`, `strength_clip`.

## 3. Sampling Nodes

- **`KSampler`**:
  - `seed`: Int64 random seed.
  - `steps`: Diffusion iterations (typical: 20-30 for SD1.5/SDXL, 20-25 for Flux).
  - `cfg`: Classifier Free Guidance scale (5-8 for SD1.5/SDXL, 1.0 or bypassed via guidance node for Flux).
  - `sampler_name`: `euler`, `euler_ancestral`, `dpmpp_2m`, `dpmpp_sde`, `uni_pc`.
  - `scheduler`: `normal`, `karras`, `exponential`, `simple`, `sgm_uniform`.
  - `denoise`: Float between 0.0 (no change) and 1.0 (full generation from noise).
- **`KSamplerAdvanced`**: Adds granular control over `start_at_step` and `end_at_step` for multi-stage refinement or base-to-refiner cascades.

## 4. Latent Space Operations

- **`EmptyLatentImage`**: Allocates empty latent tensor initialized with Gaussian distribution.
- **`VAEEncode`**: Encodes a pixel tensor (`IMAGE`) into latent representation (`LATENT`) for img2img.
- **`VAEEncodeForInpaint`**: Encodes image with binary mask; adds grow mask padding.
- **`LatentUpscale` / `LatentUpscaleBy`**: Scales latent tensors directly before a second sampling pass.

## 5. Popular Extension Nodes

- **ComfyUI-Impact-Pack**:
  - `FaceDetailer`: Detects faces via YOLO/SAM, crops latent, applies high-res inpainting, and blends seamlessly.
- **ComfyUI-ControlNet**:
  - `ControlNetLoader`: Loads ControlNet weights (Canny, Depth, OpenPose, Scribble).
  - `ApplyControlNet`: Modifies positive conditioning tensor using input guidance image.
- **ComfyUI-IPAdapter-plus**:
  - `IPAdapterModelLoader`: Loads image prompt adapters.
  - `IPAdapterApply`: Guides generation semantics and style using reference input images.

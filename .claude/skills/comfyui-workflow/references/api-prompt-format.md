# ComfyUI API Prompt Format Reference

## Structural Definition

In the ComfyUI API format, the top-level payload is a JSON object mapping arbitrary node ID strings (`"1"`, `"2"`, `"3"`) to node definition objects:

```json
{
  "client_id": "c1f7b7a1-2d4e-4f3e-8c34-8c1097e88bf9",
  "prompt": {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "cfg": 8,
        "denoise": 1,
        "latent_image": ["5", 0],
        "model": ["4", 0],
        "negative": ["7", 0],
        "positive": ["6", 0],
        "sampler_name": "euler",
        "scheduler": "normal",
        "seed": 856644801183143,
        "steps": 20
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": "v1-5-pruned-emaonly.safetensors"
      }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "batch_size": 1,
        "height": 512,
        "width": 512
      }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["4", 1],
        "text": "masterpiece, best quality, ultra-detailed architectural photography"
      }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["4", 1],
        "text": "blurry, low quality, distorted, watermark, signature"
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": ["8", 0]
      }
    }
  }
}
```

## Link Array Syntax

Whenever an input depends on another node's output, it is expressed as a 2-element array:
- `[ "<target_node_id>", <output_slot_index> ]`

For example:
- `["4", 0]` -> Node ID "4" (CheckpointLoaderSimple), output slot 0 (`MODEL`).
- `["4", 1]` -> Node ID "4" (CheckpointLoaderSimple), output slot 1 (`CLIP`).
- `["4", 2]` -> Node ID "4" (CheckpointLoaderSimple), output slot 2 (`VAE`).
- `["3", 0]` -> Node ID "3" (KSampler), output slot 0 (`LATENT`).
- `["8", 0]` -> Node ID "8" (VAEDecode), output slot 0 (`IMAGE`).

## WebSocket Protocol Flow

1. **Connect**:
   `GET ws://{host}:{port}/ws?clientId={client_id}`
2. **Submit Job**:
   `POST http://{host}:{port}/prompt` with `{ "client_id": client_id, "prompt": prompt_dict }`
   Response: `{ "prompt_id": "...", "number": 1, "node_errors": {} }`
3. **Listen for Events**:
   - `{"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 1}}}}`
   - `{"type": "execution_start", "data": {"prompt_id": "..."}}`
   - `{"type": "executing", "data": {"node": "4", "prompt_id": "..."}}`
   - `{"type": "progress", "data": {"value": 5, "max": 20, "prompt_id": "...", "node": "3"}}`
   - `{"type": "executed", "data": {"node": "9", "output": {"images": [{"filename": "ComfyUI_00001_.png", "subfolder": "", "type": "output"}]}}}`
   - `{"type": "executing", "data": {"node": null, "prompt_id": "..."}}` -> Execution finished!

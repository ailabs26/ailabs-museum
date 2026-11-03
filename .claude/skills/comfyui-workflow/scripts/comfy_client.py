#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ComfyUI API Client & Automation Harness.
Queues workflows to ComfyUI, monitors execution progress, and downloads generated images.
Compatible with Python 3.8+ on Windows, Linux, and macOS.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

# Windows console encoding hardening
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def check_server_health(host: str, port: int) -> bool:
    """Verifies ComfyUI server is reachable and responsive."""
    url = f"http://{host}:{port}/system_stats"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Agent-Client/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                devices = data.get("devices", [])
                vram_info = ""
                if devices:
                    dev = devices[0]
                    vram_free = dev.get("vram_free", 0) / (1024 * 1024 * 1024)
                    vram_total = dev.get("vram_total", 0) / (1024 * 1024 * 1024)
                    vram_info = f" | GPU: {dev.get('name', 'Unknown')} ({vram_free:.1f}GB / {vram_total:.1f}GB VRAM free)"
                print(f"[+] Connected to ComfyUI at {host}:{port}{vram_info}")
                return True
    except Exception as e:
        print(f"[-] Could not connect to ComfyUI server at {host}:{port} ({e})")
        return False
    return False


def queue_prompt(host: str, port: int, prompt_data: dict, client_id: str) -> dict:
    """Submits a prompt payload to ComfyUI /prompt endpoint."""
    url = f"http://{host}:{port}/prompt"
    payload = json.dumps({"client_id": client_id, "prompt": prompt_data}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "ComfyUI-Agent-Client/1.0"},
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def get_history(host: str, port: int, prompt_id: str) -> dict:
    """Fetches job history from ComfyUI /history endpoint."""
    url = f"http://{host}:{port}/history/{prompt_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Agent-Client/1.0"})
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def download_image(host: str, port: int, filename: str, subfolder: str, folder_type: str, dest_path: str):
    """Downloads an output image from /view endpoint."""
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    url = f"http://{host}:{port}/view?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Agent-Client/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        with open(dest_path, "wb") as f:
            f.write(response.read())


def poll_until_complete(host: str, port: int, prompt_id: str, timeout_seconds: int = 300) -> dict:
    """Polls history until the prompt execution finishes or times out."""
    start_time = time.time()
    last_status = ""
    while time.time() - start_time < timeout_seconds:
        try:
            history = get_history(host, port, prompt_id)
            if prompt_id in history:
                return history[prompt_id]
        except Exception:
            pass

        elapsed = int(time.time() - start_time)
        status_msg = f"[~] Waiting for execution... ({elapsed}s elapsed)"
        if status_msg != last_status:
            print(f"\r{status_msg}", end="", flush=True)
            last_status = status_msg
        time.sleep(1.5)

    print()
    raise TimeoutError(f"Execution timed out after {timeout_seconds} seconds.")


def main():
    parser = argparse.ArgumentParser(description="ComfyUI Workflow Automation Client")
    parser.add_argument("--host", default="127.0.0.1", help="ComfyUI host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8188, help="ComfyUI port (default: 8188)")
    parser.add_argument("--workflow", required=True, help="Path to workflow API JSON file")
    parser.add_argument("--prompt", help="Override text prompt in CLIPTextEncode nodes")
    parser.add_argument("--seed", type=int, help="Override random seed in KSampler nodes")
    parser.add_argument("--output-dir", default="./output", help="Directory to save output images")
    parser.add_argument("--timeout", type=int, default=300, help="Maximum execution timeout in seconds")

    args = parser.parse_args()

    if not os.path.isfile(args.workflow):
        print(f"[-] Workflow file not found: {args.workflow}")
        sys.exit(1)

    with open(args.workflow, "r", encoding="utf-8") as f:
        data = json.load(f)

    # If the file has a top-level 'prompt' key (API wrapper), extract it
    workflow_nodes = data.get("prompt", data)

    # Dynamic overrides
    if args.prompt:
        modified_count = 0
        for node_id, node in workflow_nodes.items():
            if isinstance(node, dict) and node.get("class_type") == "CLIPTextEncode":
                inputs = node.get("inputs", {})
                # Modify if it's the positive prompt (typically has higher node ID or longer text)
                text = inputs.get("text", "")
                if "negative" not in text.lower() and "bad" not in text.lower():
                    inputs["text"] = args.prompt
                    modified_count += 1
        if modified_count:
            print(f"[+] Overrode prompt text in {modified_count} CLIPTextEncode node(s).")

    if args.seed is not None:
        for node_id, node in workflow_nodes.items():
            if isinstance(node, dict) and "KSampler" in node.get("class_type", ""):
                node.get("inputs", {})["seed"] = args.seed
                print(f"[+] Overrode seed to {args.seed} in node {node_id}")

    # Check server
    if not check_server_health(args.host, args.port):
        print("[-] Aborting: Server unavailable.")
        sys.exit(1)

    client_id = str(uuid.uuid4())
    print(f"[+] Queueing workflow with Client ID: {client_id}")

    try:
        res = queue_prompt(args.host, args.port, workflow_nodes, client_id)
        prompt_id = res.get("prompt_id")
        if not prompt_id:
            print(f"[-] Failed to queue workflow: {res}")
            sys.exit(1)
        print(f"[+] Job queued successfully. Prompt ID: {prompt_id}")
    except Exception as e:
        print(f"[-] Error submitting prompt: {e}")
        sys.exit(1)

    # Monitor execution
    try:
        job_result = poll_until_complete(args.host, args.port, prompt_id, timeout_seconds=args.timeout)
        print(f"\n[+] Execution completed successfully!")
    except Exception as e:
        print(f"\n[-] Execution failed or timed out: {e}")
        sys.exit(1)

    # Collect and download images
    os.makedirs(args.output_dir, exist_ok=True)
    outputs = job_result.get("outputs", {})
    downloaded = 0

    for node_id, node_output in outputs.items():
        if "images" in node_output:
            for img in node_output["images"]:
                filename = img.get("filename")
                subfolder = img.get("subfolder", "")
                folder_type = img.get("type", "output")
                dest = os.path.join(args.output_dir, filename)
                print(f"[+] Downloading generated image: {filename} -> {dest}")
                try:
                    download_image(args.host, args.port, filename, subfolder, folder_type, dest)
                    downloaded += 1
                except Exception as e:
                    print(f"[-] Failed to download image {filename}: {e}")

    print(f"[+] Done. Total {downloaded} image(s) saved to '{args.output_dir}'.")


if __name__ == "__main__":
    main()

"""Upscale one video 2x with Real-ESRGAN on PyTorch MPS, keeping its audio.

Used for the `realesrgan-2x` candidate (plan 10b path A1). The model is loaded with spandrel, which ComfyUI already
installs, so this runs with the Python of the ComfyUI virtual environment (see spikes/mac/INSTALL-LOG.md). ffmpeg
splits the video into PNG frames, each frame is upscaled, and ffmpeg encodes the result at the source frame rate with
the source audio copied unchanged.
"""

import argparse
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import spandrel
import torch
from PIL import Image

# Official RealESRGAN_x2plus release weights (BSD-3-Clause), downloaded outside the repository.
DEFAULT_WEIGHTS = Path.home() / "tapestry-spikes" / "realesrgan" / "RealESRGAN_x2plus.pth"

# Same encoder quality as the video drivers, so the upscale is not judged through extra compression.
CRF = "18"


def pick_device() -> str:
    """Return the fastest available torch device name: "mps" on Apple Silicon, otherwise "cpu"."""
    return "mps" if torch.backends.mps.is_available() else "cpu"


def frame_rate(video: Path) -> str:
    """Return the frame rate of the first video stream as ffprobe reports it, e.g. "24/1".

    Args:
        video: The source video.
    """
    return subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
         "-of", "csv=p=0", str(video)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


def load_model(weights: Path, device: str) -> spandrel.ImageModelDescriptor:
    """Load an upscaling model without running pickled code (weights only).

    Args:
        weights: Path of a .pth or .safetensors checkpoint that spandrel recognises.
        device: Torch device to move the model to.
    """
    state = torch.load(weights, map_location="cpu", weights_only=True)
    model = spandrel.ModelLoader().load_from_state_dict(state)
    return model.to(device).eval()


def upscale(source: Path, out: Path, weights: Path) -> None:
    """Upscale every frame of `source` and write the result, with the source audio, to `out`.

    Args:
        source: Video to upscale.
        out: Where to write the upscaled mp4.
        weights: Model checkpoint, see `load_model`.
    """
    device = pick_device()
    model = load_model(weights, device)
    work = Path(tempfile.mkdtemp(prefix="realesrgan-"))
    try:
        (work / "in").mkdir()
        (work / "out").mkdir()
        subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(source), str(work / "in" / "f_%05d.png")], check=True)
        frames = sorted((work / "in").glob("*.png"))
        started = time.time()
        with torch.inference_mode():
            for frame in frames:
                pixels = np.asarray(Image.open(frame).convert("RGB"), dtype=np.float32) / 255
                tensor = torch.from_numpy(pixels).permute(2, 0, 1).unsqueeze(0).to(device)
                result = model(tensor).clamp(0, 1).squeeze(0).permute(1, 2, 0).cpu().numpy()
                Image.fromarray((result * 255).round().astype(np.uint8)).save(work / "out" / frame.name)
        print(f"device={device} frames={len(frames)} upscale_seconds={time.time() - started:.1f}")
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-framerate", frame_rate(source), "-i", str(work / "out" / "f_%05d.png"),
             "-i", str(source), "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", CRF,
             "-c:a", "copy", str(out)],
            check=True,
        )
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> None:
    """Parse command-line arguments and upscale one video."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    args = parser.parse_args()
    upscale(args.source, args.out, args.weights)


if __name__ == "__main__":
    main()

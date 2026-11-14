"""Generate one instrumental clip with MusicGen through Hugging Face transformers.

Used for the `musicgen` candidate in plan 10. audiocraft itself pins torch 2.1, which has no wheels for Python 3.12,
so this runs the same weights through `transformers` on PyTorch MPS instead. Run it with the Python of the musicgen
virtual environment (see spikes/mac/INSTALL-LOG.md), never from inside a downloaded project folder.
"""

import argparse
import time

import numpy as np
import scipy.io.wavfile
import torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

# MusicGen's audio codec runs at 50 token frames per second of audio.
TOKENS_PER_SECOND = 50

# Default model: the small checkpoint (300M parameters), quickest to try.
DEFAULT_MODEL = "facebook/musicgen-small"


def pick_device() -> str:
    """Return the fastest available torch device name: "mps" on Apple Silicon, otherwise "cpu"."""
    return "mps" if torch.backends.mps.is_available() else "cpu"


def generate(model_id: str, prompt: str, seconds: float, seed: int, out_path: str) -> None:
    """Generate `seconds` of music for `prompt` and write it as a 16-bit WAV file.

    Args:
        model_id: Hugging Face repository id of a MusicGen checkpoint.
        prompt: Text description of the music (style, instruments, mood).
        seconds: Length of audio to generate; MusicGen is trained on 30 s, longer is unreliable.
        seed: Random seed, so a run can be repeated.
        out_path: Where to write the WAV file.
    """
    device = pick_device()
    torch.manual_seed(seed)
    processor = AutoProcessor.from_pretrained(model_id)
    model = MusicgenForConditionalGeneration.from_pretrained(model_id).to(device)
    inputs = processor(text=[prompt], padding=True, return_tensors="pt").to(device)
    started = time.time()
    audio = model.generate(**inputs, do_sample=True, max_new_tokens=int(seconds * TOKENS_PER_SECOND))
    print(f"device={device} generate_seconds={time.time() - started:.1f}")
    rate = model.config.audio_encoder.sampling_rate
    samples = audio[0, 0].float().cpu().numpy()
    scipy.io.wavfile.write(out_path, rate, (np.clip(samples, -1, 1) * 32767).astype(np.int16))


def main() -> None:
    """Parse command-line arguments and run one generation."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--seconds", type=float, default=30)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    generate(args.model, args.prompt, args.seconds, args.seed, args.out)


if __name__ == "__main__":
    main()

"""Generate one music cue from spikes/music/cues.json with ACE-Step 1.5, as one measurable command for bench.mjs.

Run it with the Python of the ACE-Step virtual environment (see spikes/mac/INSTALL-LOG.md), from the repository root,
never from inside the downloaded ACE-Step folder:

    ~/tapestry-spikes/ace-step/src/.venv/bin/python spikes/mac/scripts/acestep_cue.py --cue M1 --dit turbo \
        --lm 1.7B --seed 1 --out spikes/music/results/out/acestep-turbo-lm1.7B-M1-s1.wav

`--dit` picks the music model (turbo and xl-turbo, the 4B XL version: distilled, 8 steps; sft: 50 steps with
guidance). `--lm` picks the 5 Hz language model that plans the song (structure, timing, audio codes) before the
music model renders it; `none` skips it, which is ACE-Step's fastest mode. The script prints model load
and generation seconds separately.
"""

import argparse
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

from acestep.handler import AceStepHandler
from acestep.inference import GenerationConfig, GenerationParams, generate_music
from acestep.llm_inference import LLMHandler

# The ACE-Step checkout; its checkpoints/ folder holds the downloaded models.
DEFAULT_ROOT = Path.home() / "tapestry-spikes" / "ace-step" / "src"

# The fixed briefs, relative to the repository root this script is run from.
CUES = Path("spikes/music/cues.json")

# Music-model folders under checkpoints/ and their reference settings (ACE-Step docs/en/INFERENCE.md: turbo 8 steps,
# guidance baked in and shift 3; SFT 32-64 steps with guidance 5-9).
DITS = {
    "turbo": {"config": "acestep-v15-turbo", "steps": 8, "guidance": 1.0, "shift": 3.0},
    "sft": {"config": "acestep-v15-sft", "steps": 50, "guidance": 7.0, "shift": 1.0},
    "xl-turbo": {"config": "acestep-v15-xl-turbo", "steps": 8, "guidance": 1.0, "shift": 3.0},
}

# Language-model folders under checkpoints/; "none" generates without the planning model.
LMS = {"0.6B": "acestep-5Hz-lm-0.6B", "1.7B": "acestep-5Hz-lm-1.7B", "4B": "acestep-5Hz-lm-4B"}


def load_cue(cue_id: str) -> dict:
    """Return one brief from the cues file.

    Args:
        cue_id: The cue's id, e.g. "M1".
    """
    cues = json.loads(CUES.read_text())["cues"]
    found = [c for c in cues if c["id"] == cue_id]
    if not found:
        sys.exit(f"unknown cue {cue_id}; known: {', '.join(c['id'] for c in cues)}")
    return found[0]


def generate(root: Path, cue: dict, dit: str, lm: str, seed: int, out: Path) -> None:
    """Load the models, render the cue and write it as a WAV file.

    Args:
        root: The ACE-Step checkout (with checkpoints/).
        cue: One brief from the cues file (caption, seconds, bpm, keyscale, optional lyrics).
        dit: Key of DITS.
        lm: Key of LMS, or "none".
        seed: Random seed, so a run can be repeated.
        out: Where to write the WAV file.
    """
    started = time.time()
    dit_handler = AceStepHandler()
    message, ok = dit_handler.initialize_service(project_root=str(root), config_path=DITS[dit]["config"], device="auto")
    if not ok:
        sys.exit(f"music model failed to load: {message}")
    llm_handler = LLMHandler()
    if lm != "none":
        message, ok = llm_handler.initialize(
            checkpoint_dir=str(root / "checkpoints"), lm_model_path=LMS[lm], backend="mlx", device="auto"
        )
        if not ok:
            sys.exit(f"language model failed to load: {message}")
    print(f"load_seconds={time.time() - started:.1f}")

    lyrics = cue.get("lyrics", "")
    params = GenerationParams(
        task_type="text2music",
        thinking=lm != "none",
        caption=cue["caption"],
        lyrics=lyrics,
        instrumental=not lyrics,
        vocal_language="en" if lyrics else "unknown",
        bpm=cue.get("bpm"),
        keyscale=cue.get("keyscale", ""),
        duration=cue["seconds"],
        inference_steps=DITS[dit]["steps"],
        guidance_scale=DITS[dit]["guidance"],
        shift=DITS[dit]["shift"],
        seed=seed,
    )
    config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[seed], audio_format="wav")
    with tempfile.TemporaryDirectory() as save_dir:
        started = time.time()
        result = generate_music(dit_handler, llm_handler, params=params, config=config, save_dir=save_dir)
        print(f"generate_seconds={time.time() - started:.1f}")
        if not result.success:
            sys.exit(f"generation failed: {result.status_message}")
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(result.audios[0]["path"], out)


def main() -> None:
    """Parse command-line arguments and render one cue."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cue", required=True)
    parser.add_argument("--dit", choices=sorted(DITS), default="turbo")
    parser.add_argument("--lm", choices=[*LMS, "none"], default="1.7B")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    generate(args.root, load_cue(args.cue), args.dit, args.lm, args.seed, args.out)


if __name__ == "__main__":
    main()

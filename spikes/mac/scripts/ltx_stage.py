"""Split LTX 2.3's distilled two-stage render into a draft and a later final (plan 10b, path B).

The distilled pipeline denoises at half resolution (stage 1), upsamples the latent 2x and refines it at full
resolution (stage 2). ltx-2-mlx can return stage 1 and resume from it, and a resumed render is bit-identical to an
uninterrupted one. So:

- `draft` runs stage 1 only, decodes that half-resolution latent to a watchable mp4 and saves the latent next to it;
- `final` loads a saved draft latent and runs only the upsample and stage 2, with as many stage-2 steps as asked.

Fewer stage-2 steps start the refine at a lower noise level (the tail of the stage-2 sigma table, 0.909 / 0.725 /
0.422 for 3 / 2 / 1 steps), which keeps more of the draft. The stage-2 noise seed is free, so one draft can have
several finals.

Run it with the Python of the ltx-2-mlx virtual environment (see spikes/mac/INSTALL-LOG.md), from the repository root.
"""

import argparse
import json
from pathlib import Path

import mlx.core as mx
from ltx_pipelines_mlx.distilled import DistilledPipeline, Stage1Result
from ltx_core_mlx.utils.memory import aggressive_cleanup

# Frame rate LTX 2.3 was trained at.
FRAME_RATE = 24.0

# Default weights: the int4 pack used in plan 10.
DEFAULT_MODEL = str(Path.home() / "tapestry-spikes" / "ltx-2-mlx" / "models" / "ltx-2.3-mlx-q4")


def latent_path(video: Path) -> Path:
    """Return where the stage-1 latent of a draft video is kept: next to it, `.latent.safetensors`.

    Args:
        video: The draft mp4.
    """
    return video.with_suffix(".latent.safetensors")


def make_pipeline(model: str) -> DistilledPipeline:
    """Build the distilled pipeline as the `generate --distilled` command does (low memory on, audio on).

    Args:
        model: Folder or Hugging Face id of an LTX 2.3 MLX pack.
    """
    pipe = DistilledPipeline(model_dir=model, low_memory=True)
    pipe.verbose = True
    pipe.generate_audio = True
    return pipe


def decode(pipe: DistilledPipeline, video_latent: mx.array, audio_latent: mx.array, out: Path, seed: int) -> None:
    """Free the transformer, then decode both latents and write the mp4 (as `generate_and_save` does).

    Args:
        pipe: The pipeline that made the latents.
        video_latent: Video latent, `(1, 128, F, H, W)`.
        audio_latent: Audio latent from the pipeline's audio patchifier.
        out: Where to write the mp4.
        seed: Seed passed on to the decoder.
    """
    pipe.dit = None
    pipe.prompt_encoder.free()
    pipe.image_conditioner.free()
    pipe.upsampler = None
    pipe._loaded = False
    aggressive_cleanup()
    pipe._load_decoders()
    pipe._decode_and_save_video(video_latent, audio_latent, str(out), frame_rate=FRAME_RATE, seed=seed)


def draft(args: argparse.Namespace) -> None:
    """Run stage 1 only, write the half-resolution draft and save its latent for `final`.

    Args:
        args: Parsed command line (prompt, height, width, frames, seed, stage1_steps, out, model).
    """
    pipe = make_pipeline(args.model)
    stage1, frames, height, width = pipe._stage1(
        args.prompt, args.height, args.width, args.frames, frame_rate=FRAME_RATE, seed=args.seed,
        stage1_steps=args.stage1_steps, image=None, images=None, prompt_relay=None, generated_keyframes=0,
        enable_teacache=False,
    )
    request = {"prompt": args.prompt, "height": height, "width": width, "frames": frames, "seed": args.seed,
               "latent_dims": list(stage1.latent_dims)}
    mx.save_safetensors(str(latent_path(args.out)),
                        {"video_tokens": stage1.video_tokens, "audio_tokens": stage1.audio_tokens},
                        metadata={"request": json.dumps(request)})
    video = pipe.video_patchifier.unpatchify(stage1.video_tokens, stage1.latent_dims)
    audio = pipe.audio_patchifier.unpatchify(stage1.audio_tokens)
    print(f"draft {width // 2}x{height // 2}, final will be {width}x{height}")
    decode(pipe, video, audio, args.out, args.seed)


def final(args: argparse.Namespace) -> None:
    """Upsample a saved draft latent and refine it at full resolution, then write the final.

    Args:
        args: Parsed command line (draft, stage2_steps, seed, out, model). The prompt and size come from the draft.
    """
    saved, metadata = mx.load(str(latent_path(args.draft)), return_metadata=True)
    request = json.loads(metadata["request"])
    seed = request["seed"] if args.seed is None else args.seed
    resume = Stage1Result(
        video_tokens=saved["video_tokens"], audio_tokens=saved["audio_tokens"], generated_keyframes=None,
        latent_dims=tuple(request["latent_dims"]), resolved_images=[], video_embeds=None, audio_embeds=None,
        relay_mask=None, relay_audio_mask=None, x0_model=None, nag=None,
    )
    pipe = make_pipeline(args.model)
    # The stage-2 noise uses `seed`; stage 1 is taken from the draft whatever the seed.
    video, audio = pipe.generate_two_stage(
        request["prompt"], request["height"], request["width"], request["frames"], frame_rate=FRAME_RATE,
        seed=seed, stage2_steps=args.stage2_steps, stage1=resume,
    )
    decode(pipe, video, audio, args.out, seed)


def main() -> None:
    """Parse the command line and run `draft` or `final`."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    commands = parser.add_subparsers(dest="command", required=True)
    d = commands.add_parser("draft", help="stage 1 only: half-resolution draft plus its saved latent")
    d.add_argument("--prompt", required=True)
    d.add_argument("--height", type=int, default=480, help="height of the final; the draft is half (snapped to 64)")
    d.add_argument("--width", type=int, default=832, help="width of the final; the draft is half (snapped to 64)")
    d.add_argument("--frames", type=int, default=97)
    d.add_argument("--seed", type=int, default=1)
    d.add_argument("--stage1-steps", type=int, default=None, help="default: the full distilled table (8)")
    d.add_argument("--out", type=Path, required=True)
    f = commands.add_parser("final", help="upsample and refine a saved draft")
    f.add_argument("--draft", type=Path, required=True, help="the draft mp4; its latent is read from next to it")
    f.add_argument("--stage2-steps", type=int, default=None, help="3 (default), 2 or 1: fewer keeps more of the draft")
    f.add_argument("--seed", type=int, default=None, help="stage-2 noise seed (default: the draft's seed)")
    f.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    draft(args) if args.command == "draft" else final(args)


if __name__ == "__main__":
    main()

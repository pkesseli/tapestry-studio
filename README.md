# Tapestry Studio

Free and open source (Apache-2.0) studio for making films and music with AI. Write a script, create characters,
places, voices and instruments as you go, queue generations on your own machine or a provider API, review them when
they are ready, and assemble the result.

> **Heads-up: this is a work in progress.** Tapestry Studio is young and still taking shape. You can already write a
> screenplay in the app and see how scenes and shots fit together, but actually *making* videos and music isn't wired
> up yet. If this sounds like your kind of thing, welcome! Come back in a few weeks, there should be a lot more to try
> by then. In the meantime, feel free to star or watch the repo and watch it grow.

- Contributors and AI agents: start with [AGENTS.md](AGENTS.md).
- Mission and principles: [doc/readme/vision.md](doc/readme/vision.md).
- Roadmap: the numbered files in [doc/plan/](doc/plan/).

## Development

Needs Node.js 24+ and pnpm 12. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup.

```sh
pnpm install
pnpm dev        # run the app with hot reload (opens "Tapestry Studio/Demo Film" in your documents
                # folder; set TAPESTRY_PROJECT to use another folder)
pnpm verify     # format check, repo rules, typecheck, lint, tests, build
pnpm test:e2e   # launch the built app with Playwright
```

To try the interface with footage before real generation exists, give a project sample clips (close the app first, it
keeps its own copy). Any folder of `.mp4` files works; the project is created if the folder is empty:

```sh
pnpm tapestry demo-footage <project-folder> <folder-with-mp4-files>
```

License: [Apache-2.0](LICENSE). Content you create with the tool is yours; generated media is also subject to the terms
of the model or provider that produced it.

*Die Gedanken sind frei* ("thoughts are free"): the name and the mission are about everyone being able to give their
ideas a form. Tapestry Studio is not affiliated with the Apache Tapestry web framework or the Apache Software
Foundation.

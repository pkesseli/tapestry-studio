# Tapestry Studio

Free and open source (Apache-2.0) studio for making films and music with AI. Write a script, create characters,
places, voices and instruments as you go, queue generations on your own machine or a provider API, review them when
they are ready, and assemble the result.

**Status:** pre-alpha, planning stage. Nothing runs yet.

- Contributors and AI agents: start with [AGENTS.md](AGENTS.md).
- Mission and principles: [doc/readme/vision.md](doc/readme/vision.md).
- Roadmap: the numbered files in [doc/plan/](doc/plan/).

## Development

Needs Node.js 24+ and pnpm 12. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup.

```sh
pnpm install
pnpm dev        # run the Electron app with hot reload
pnpm verify     # format check, repo rules, typecheck, lint, tests, build
pnpm test:e2e   # launch the built app with Playwright
```

License: [Apache-2.0](LICENSE). Content you create with the tool is yours; generated media is also subject to the terms
of the model or provider that produced it.

*Die Gedanken sind frei* ("thoughts are free"): the name and the mission are about everyone being able to give their
ideas a form. Tapestry Studio is not affiliated with the Apache Tapestry web framework or the Apache Software
Foundation.

# Contributing

Thanks for helping. Bug reports, fixes and focused improvements are welcome.

## Before you start

- For a bug, open an issue with your Chrome version, OS, what you did and what you expected. A short recording or export helps.
- For a new feature or a large change, open an issue first so we can agree on the approach before you spend time on it.
- Security issues go by email, not issues. See [SECURITY.md](SECURITY.md).

## Development

```bash
bun install
bun run build
```

Load `dist/` with **Load unpacked** on `chrome://extensions`. [AGENTS.md](AGENTS.md) explains the architecture and why things are built the way they are.

Before opening a pull request, run:

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

## Style

- TypeScript strict, React function components, Tailwind.
- Match the code around your change. Keep changes small and focused on one thing.
- No code comments. Prefer clear names and small functions instead.
- Add or update tests in `*.test.ts` next to the code you change when it has logic worth testing.

## Contributor License Agreement

The first time you open a pull request, a bot asks you to sign the [Contributor License Agreement](CLA.md) by posting a comment. You keep the copyright to your work. The agreement lets Screenix ship your contribution in the open source version and in commercially licensed versions. Pull requests can't be merged until it is signed.

## License

By contributing, you agree that your contribution is released under the [AGPLv3](LICENSE) and covered by the [CLA](CLA.md).

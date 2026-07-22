# App auto-update (GitHub Releases)

SkillsBox uses [Tauri Updater](https://v2.tauri.app/plugin/updater/) against
**https://github.com/xiaozuoyou/SkillsBox** releases.

| Piece | Location |
|-------|----------|
| Public key (safe to commit) | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| Private key (never commit) | GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY` |
| Update manifest | `latest.json` on each Release (uploaded by CI) |
| Endpoint | `…/releases/latest/download/latest.json` |
| Platforms (now) | macOS Apple Silicon (`aarch64-apple-darwin`) |
| Platforms (later) | Add Windows jobs + platform entries in CI |

## One-time: install signing secret

A keypair was generated for this project. The **private** key lives only on the
machine that generated it (local path: `secrets/tauri-updater.key`, gitignored).

Upload it to the repo:

```bash
# From a machine that has secrets/tauri-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo xiaozuoyou/SkillsBox < secrets/tauri-updater.key
```

Optional (only if you re-generate with a password):

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo xiaozuoyou/SkillsBox
```

If you **lose** the private key, generate a new pair and replace `pubkey` in
`tauri.conf.json` (existing installs will only accept the old key until they
manually install a new build signed with the new key).

```bash
pnpm tauri signer generate -w secrets/tauri-updater.key
# put .pub contents into tauri.conf.json plugins.updater.pubkey
```

## Release a version

1. Bump version in **all three** places (keep in sync):
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml` (and `src/lib/constants.ts` `APP_VERSION` if used in UI)
2. Commit, tag, push:

```bash
git tag v0.1.1
git push origin v0.1.1
```

3. GitHub Actions workflow **Release** builds macOS, signs updater artifacts, and
   publishes a GitHub Release with `latest.json`.

4. Users open **Settings → About → Check for updates**.

## Local signed build (optional)

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat secrets/tauri-updater.key)"
# export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=...  # if any
pnpm tauri build --target aarch64-apple-darwin
```

## Notes

- **Notarization / Developer ID** is separate from updater signatures. Without
  Apple notarization, Gatekeeper may still warn on first open.
- Windows will use the same `pubkey` and endpoint; add a CI matrix target when ready.
- Skill-repo “check for updates” is unrelated (git `ls-remote` in the vault).

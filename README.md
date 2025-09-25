# SDID – Chrome Extension for Identity Management 🚀

[中文文档](README_zh-CN.md)

SDID is a Chrome extension that helps teams manage decentralized identities for passwordless and passkey-first workflows. Generate DID key pairs, sign login challenges, store fallback secrets, and approve dapp requests directly from the browser toolbar.

![Demo GIF](images/1.gif)

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
  <img alt="Chrome" src="https://img.shields.io/badge/Chrome-MV3-blue">
  <img alt="Web Crypto" src="https://img.shields.io/badge/Web%20Crypto-P256%20ECDSA-orange">
  <img alt="Status" src="https://img.shields.io/badge/status-Alpha-yellow">
</p>

## Features ✨

- DID key management & signing – generate P-256 key pairs per identity, expose the DID, and sign login challenges for dapps.
- Per-site authorization control – remember approved origins for one-click logins, or revoke them later from the options page.
- Role-aware metadata – capture roles, domains, tags, and notes to describe responsibilities or access boundaries.
- Secure storage & backup – all identity data (including keys) lives in encrypted Chrome sync storage with JSON import/export support.
- Autofill fallback – keep optional usernames/passwords for legacy systems and inject them into the current tab in one click.
- Verifiable DID auth proofs – login responses ship with a canonicalized payload and W3C-style proof so relying parties can audit who signed what.
- Language toggle – switch between English and Chinese across the popup, options page, and approval overlays with a single tap.
- Minimal interface – refreshed visual styling inspired by Google/Apple design language: light surfaces, clean lines, and focused typography.
- Demo dApp – the `/demo` folder hosts a ready-to-run site that requests SDID login and verifies the returned signature.

## Quick confirm login workflow ⚡

Web apps can call SDID from the page context and receive a streamlined confirmation dialog that mirrors popular wallet-to-dapp experiences. The sheet lets the user pick an identity, review roles and DID details, and optionally remember the requesting origin. Once confirmed, SDID produces a canonical authentication payload, signs it with the identity’s private key, attaches a W3C-style proof object, and (when possible) fills matching username/password fields automatically.

### Requesting a login from a web app

1. Ensure the SDID extension is installed and the user has saved at least one identity.
2. From the web app, call `window.SDID.requestLogin()` with a challenge string, optional message, and optional preferred identity ID.
3. Wait for the promise to resolve. On success you receive sanitized identity details, a base64 signature of the challenge, autofill status, and authorization metadata; on rejection the user dismissed or denied the request.

```html
<script>
  async function connectToSdid() {
    try {
      const challenge = `demo-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
      const response = await window.SDID.requestLogin({
        message: 'Connect Example dApp to SDID',
        challenge,
      });
      console.log('SDID identity granted', response.identity);
      console.log('Proof metadata', response.proof);

      const canonicalRequest = response.authentication?.canonicalRequest || response.challenge;
      console.log('Canonical payload', response.authentication?.payload);

      const publicKey = await crypto.subtle.importKey(
        'jwk',
        response.identity.publicKeyJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      const signatureBytes = Uint8Array.from(atob(response.signature), (char) => char.charCodeAt(0));
      const verified = await crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKey,
        signatureBytes,
        new TextEncoder().encode(canonicalRequest)
      );
      console.log('Signature verified?', verified);
      // response.fill contains autofill status for traditional login forms
    } catch (error) {
      console.error('SDID login denied', error);
    }
  }
  // connectToSdid();
</script>
```

> 💡 Tip: The request/response messages use `window.postMessage` under the hood. If you implement your own bridge, filter events by `event.data.type === 'SDID_LOGIN_RESULT'`. When the bridge loads it dispatches `sdid#initialized`, so apps can wait for `window.SDID` before calling `requestLogin`.

### Demo dApp 🧪

The repository ships with a static demo site located in the [`demo/`](demo) folder. It generates a challenge, requests approval, and verifies the returned signature.

Run any static file server pointed at the `demo` directory, then open the site in Chrome with the extension loaded:

```bash
npx serve demo
# or
python -m http.server --directory demo
```

Use the "Connect with SDID" button to trigger the approval flow. The page will show the returned identity payload and whether the signature verifies against the supplied challenge.

## Getting started 🛠️

1. Open `chrome://extensions/` in Chrome.
2. Enable Developer mode in the top right corner.
3. Choose Load unpacked and select the `extension` folder from this repository.
4. Pin the “SDID Identity Manager” extension to your toolbar for quick access.
5. On a dApp page, open the SDID popup and click "Enable for this site" to grant runtime access and inject the DID bridge immediately.

## Managing identities 👤

- Use the toolbar popup to search identities, copy DIDs or public keys, autofill legacy credentials, and revoke the current site’s authorization with one click.
- Open the Manage button in the popup (or right-click the toolbar icon and choose Options) to create identities, generate or rotate DID key pairs, reveal or copy private keys, and review per-site authorization history.
- If you are new to the tool, press "Create demo identities" to load sample DIDs that showcase roles, notes, and authorized sites.

## Development 🧰

The extension is built with Manifest V3 and plain JavaScript. Customize it by editing files inside the `extension/` directory. No build step is required – reload the extension in Chrome after saving changes.

## License 📄

This project is released under the MIT License. See [LICENSE](LICENSE).

---

## Why SDID? 🤔

- You keep ownership of keys and choose what to share.
- Works great with modern passkey-first sites and legacy forms.
- Tiny, auditable code with minimal permissions.

If you like this project, consider giving it a ⭐ — it helps others find it!

---

## Architecture

SDID follows a minimal, privacy-preserving architecture using Chrome Manifest V3 and standard Web Crypto APIs.

- Core components
  - Background service worker: persistent brain for key management, authorization, and messaging between content/popup/options.
  - Content script: injects a small bridge into web pages so apps can call `window.SDID` without extra permissions.
  - Page bridge (`pageBridge.js`): runs in the page context, relays requests to the extension via `postMessage`.
  - Popup UI: quick access to identities, autofill, site authorization, and copy actions.
  - Options page: full CRUD for identities, keys, metadata, import/export, and site authorization history.

- Data flow
  1. Web app calls `window.SDID.requestLogin()` with a challenge.
  2. Bridge forwards the request to the background.
  3. User approves in a confirmation sheet (popup/overlay).
  4. Background canonicalizes payload, signs with the chosen identity key, returns proof and minimal identity metadata.
  5. Optional: content script autofills legacy forms if configured.

- Storage
  - Chrome sync storage (encrypted at rest by Chrome) for identities, keys, and settings.
  - Optional JSON import/export for backup and migration.

## Design principles

- Minimal permissions: inject only when the user approves a site; avoid broad host permissions.
- Verifiable by default: canonicalized payloads with explicit proof objects.
- Key portability: export/import via JSON with explicit user action only.
- Clear separation: page, content, and extension contexts communicate via explicit message channels.

## API reference

SDID exposes a small page-level API once enabled for a site.

### `window.SDID.requestLogin(options)`

- Parameters
  - `challenge` (string, required): opaque string provided by the relying party.
  - `message` (string, optional): human-readable hint shown in the approval UI.
  - `preferredIdentityId` (string, optional): suggest a specific identity to use.

- Returns (Promise)
  - `identity`: sanitized identity metadata (id, name, did, publicKeyJwk, tags).
  - `signature` (base64): ECDSA P-256 signature over the canonical request string.
  - `authentication`: `{ canonicalRequest, payload }` for reproducible verification.
  - `proof`: W3C-style proof object detailing type, algorithm, and created time.
  - `fill`: autofill status for legacy forms when applicable.

- Errors
  - User cancelled or denied.
  - Site not authorized.
  - Malformed request.

Verification example is provided in the Quick workflow section above.

## Security model

- Key material: generated and stored locally via Web Crypto; private keys never leave the extension unless explicitly exported by the user.
- Authorization: per-origin allowlist; users can revoke from the options page at any time.
- Canonicalization: authentication payloads are canonicalized to prevent signature ambiguity and replay across different field orders.
- Isolation: page code cannot directly access extension internals; only the minimal API via `postMessage` is exposed.
- Backup hygiene: exports are plain JSON; treat as sensitive and store securely.

## Installation & usage

1. Load the unpacked extension from the `extension/` directory via `chrome://extensions` (Developer mode).
2. Create one or more identities in the Options page; optionally import from JSON.
3. Open a website (or the included demo) and click the toolbar icon, then Enable for this site.
4. From the site, call `window.SDID.requestLogin()` to begin the approval flow.

## Troubleshooting

- `window.SDID` is undefined
  - Ensure you clicked "Enable for this site" in the popup, or the site was previously authorized.
  - Reload the page after enabling.

- Signature verification fails
  - Recreate the exact canonical string returned in `authentication.canonicalRequest`.
  - Check you imported the JWK with `{ name: 'ECDSA', namedCurve: 'P-256' }` and SHA-256.

- Cannot see identities in popup
  - Verify identities exist in the Options page.
  - If imported, confirm the JSON structure matches the expected schema.

## Roadmap

- Optional passkey (WebAuthn) bridge for non-DID sites.
- Multiple key algorithms (Ed25519) behind a compatibility flag.
- Per-identity hardware-backed keys when available.
- Fine-grained per-site scopes for data disclosure.

## Contributing

Contributions are welcome! Please:

- Open an issue to discuss significant changes.
- Keep PRs focused and well-documented.
- Follow existing code style and avoid unrelated refactors.

## FAQ

- Why DIDs instead of just passkeys?
  - DIDs provide portable identifiers and signatures usable across contexts, while passkeys target WebAuthn/RP flows. SDID emphasizes verifiable, portable auth artifacts.

- Is my data synced between machines?
  - Yes, via Chrome sync storage if enabled. Treat exports as sensitive backups.

- Can sites track me via DID?
  - Use separate identities per context/domain and avoid reusing DIDs where linkability is a concern.

# SDID – Chrome Extension for Identity Management

SDID is a Chrome extension that helps teams manage reusable digital identities for passwordless and passkey-first
workflows. Store credentials, keep notes, and fill login forms with a single click directly from the browser toolbar.

## Features

- **Encrypted browser storage** – identities are stored with Chrome sync storage so they can follow you across devices.
- **One-click form filling** – use the popup to send usernames and passwords into the active tab.
- **Rich identity profiles** – capture notes, domains, and tags to quickly find the right login for each system.
- **Import / export** – back up your data as JSON or migrate between browsers.
- **Demo data** – populate sample identities to explore the workflow instantly.

## Getting started

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** in the top right corner.
3. Choose **Load unpacked** and select the `extension` folder from this repository.
4. Pin the “SDID Identity Manager” extension to your toolbar for quick access.

## Managing identities

- Use the toolbar popup to search, copy, or fill identities into the current page.
- Open the **Manage** button in the popup (or right click the toolbar icon and choose *Options*) to add, edit, or
  import identities.
- If you are new to the tool, press **Create demo identities** to see pre-filled examples you can modify.

## Development

The extension is built with Manifest V3 and plain JavaScript. You can customize it by editing the files inside the
`extension/` directory. No build step is required – reload the extension in Chrome after saving changes.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

# SDID – Chrome Extension for Identity Management（SDID 身份管理扩展）

SDID is a Chrome extension that helps teams manage decentralized identities for passwordless and passkey-first workflows. Generate DID key pairs, sign login challenges, store fallback secrets, and approve dapp requests directly from the browser toolbar.

SDID 是一个 Chrome 浏览器扩展，帮助团队在无密码或通行密钥优先的场景下管理去中心化身份。你可以生成 DID 密钥对、为登录挑战签名、保存备用凭据，并在工具栏上一键审批 dapp 请求。

![演示动画](images/demo.gif)

## Features｜功能特点

- **DID key management & signing｜DID 密钥管理与签名** – generate P-256 key pairs per identity, expose the DID, and sign login challenges for dapps. / 为每个身份生成 P-256 密钥对，公开 DID，并为去中心化应用的登录挑战生成签名。
- **Per-site authorization control｜站点授权控制** – remember approved origins for one-click logins, or revoke them later from the options page. / 记住已授权的站点以便下次一键登录，也可在选项页随时撤销。
- **Role-aware metadata｜角色与标签元数据** – capture roles, domains, tags, and notes to describe responsibilities or access boundaries. / 记录角色、域名、标签和备注，清晰表达权限范围与使用说明。
- **Secure storage & backup｜安全存储与备份** – all identity data (including keys) lives in encrypted Chrome sync storage with JSON import/export support. / 身份数据（包含密钥）保存在受加密保护的 Chrome 同步存储中，并支持 JSON 导入导出备份。
- **Autofill fallback｜表单自动填充备援** – keep optional usernames/passwords for legacy systems and inject them into the current tab in one click. / 可为传统系统保存备用用户名与密码，并在当前页面一键填充。
- **Verifiable DID auth proofs｜可验证的 DID 授权凭证** – login responses ship with a canonicalized payload and W3C-style proof so relying parties can audit who signed what. / 登录响应附带经过规范化的负载与 W3C 风格的证明对象，方便接入方验证签名者与签名内容。
- **Language toggle｜语言切换** – switch between English and Chinese across the popup, options page, and approval overlays with a single tap. / 弹窗、选项页与确认覆盖层均可一键切换中英文，界面即时更新。
- **Minimal interface｜纯色线条界面** – refreshed visual styling inspired by Google/Apple design language: light surfaces, clean lines, and focused typography. / 参考 Google 与 Apple 的设计语言，界面以纯色与线条为主，排版更简洁、层次更清晰。
- **Demo dApp｜演示应用** – the `/demo` folder hosts a ready-to-run site that requests SDID login and verifies the returned signature. / `/demo` 目录提供可直接运行的站点，用于发起 SDID 登录并验证返回的签名。

## Quick confirm login workflow｜快捷确认登录流程

Web apps can call SDID from the page context and receive a streamlined confirmation dialog that mirrors popular wallet-to-dapp experiences. The sheet lets the user pick an identity, review roles and DID details, and optionally remember the requesting origin. Once confirmed, SDID produces a canonical authentication payload, signs it with the identity’s private key, attaches a W3C-style proof object, and (when possible) fills matching username/password fields automatically.

网页应用可以直接在页面上下文中调用 SDID，并获得与常见钱包连接类似的快速确认体验。弹窗会展示身份名称、角色与 DID 详情，用户可选择记住当前站点。确认后，SDID 会生成经过规范化的认证负载，用该身份的私钥签名并附上符合 W3C 规范的证明对象，同时在检测到用户名或密码输入框时自动填充。

### Requesting a login from a web app｜在网页应用中发起登录请求

1. Ensure the SDID extension is installed and the user has saved at least one identity. / 请确认已安装 SDID 扩展并保存至少一个身份。
2. From the web app, call `window.SDID.requestLogin()` with a challenge string, optional message, and optional preferred identity ID. / 在网页中调用 `window.SDID.requestLogin()`，传入挑战字符串及可选的提示信息或期望使用的身份 ID。
3. Wait for the promise to resolve. On success you receive sanitized identity details, a base64 signature of the challenge, autofill status, and authorization metadata; on rejection the user dismissed or denied the request. / 等待 Promise 结果：成功时会返回经过处理的身份信息、挑战消息的 base64 签名、自动填充状态及授权信息；失败表示用户取消或拒绝了请求。

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
      // If you need to re-create the canonical string, reuse the JSON canonicalization logic from the extension.

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
</script>
```

> The request/response messages use `window.postMessage` under the hood. If you implement your own bridge, be sure to filter events by `event.data.type === 'SDID_LOGIN_RESULT'`. / 请求与响应基于 `window.postMessage` 实现，若自行构建桥接逻辑，请注意仅处理 `event.data.type === 'SDID_LOGIN_RESULT'` 的事件。

> When the bridge loads it dispatches a `sdid#initialized` event, so apps can wait for `window.SDID` before calling `requestLogin`. / 桥接脚本加载后会触发 `sdid#initialized` 事件，便于应用在调用 `requestLogin` 前确认 `window.SDID` 已就绪。

### Demo dApp｜演示站点

The repository ships with a static demo site located in the [`demo/`](demo) folder. It exercises the new DID flow by generating a challenge, requesting approval, and verifying the returned signature.

仓库内置的 [`demo/`](demo) 目录提供了一个静态演示站点，可用于生成挑战、发起授权并验证返回的签名。

Run any static file server pointed at the `demo` directory, then open the site in Chrome with the extension loaded:

在 `demo` 目录下启动任意静态文件服务器，并在加载了扩展的 Chrome 中打开该站点：

```bash
npx serve demo
# or
python -m http.server --directory demo
```

Use the **Connect with SDID｜连接 SDID** button to trigger the approval flow. The page will show the returned identity payload and whether the signature verifies against the supplied challenge.

点击 **Connect with SDID｜连接 SDID** 按钮即可触发审批流程，页面会展示返回的身份信息以及签名验证结果。

## Getting started｜快速开始

1. Open `chrome://extensions/` in Chrome. / 在 Chrome 中打开 `chrome://extensions/`。
2. Enable **Developer mode** in the top right corner. / 在右上角启用 **开发者模式**。
3. Choose **Load unpacked** and select the `extension` folder from this repository. / 点击 **加载已解压的扩展程序** 并选择仓库中的 `extension` 目录。
4. Pin the “SDID Identity Manager” extension to your toolbar for quick access. / 将“SDID Identity Manager”扩展固定到浏览器工具栏，方便快速使用。
5. Open the SDID popup on the dapp page and click **Enable for this site｜为此站点启用** to grant runtime access and inject the DID bridge immediately. / 在 dApp 页面点击 SDID 扩展图标，再按下 **Enable for this site｜为此站点启用** 按钮授予运行时权限，即刻注入 DID 桥接脚本。

## Managing identities｜身份管理

- Use the toolbar popup to search identities, copy DIDs or public keys, autofill legacy credentials, and revoke the current site’s authorization with one click. / 通过工具栏弹窗搜索身份、复制 DID 或公钥、一键填充传统凭据，并可随时撤销当前站点授权。
- Open the **Manage** button in the popup (or right-click the toolbar icon and choose *Options*) to create identities, generate or rotate DID key pairs, reveal or copy private keys, and review per-site authorization history. / 点击弹窗中的 **Manage 管理**（或右键扩展图标选择 *选项*）以创建身份、生成或轮换 DID 密钥、查看/复制私钥，并审查每个站点的授权记录。
- If you are new to the tool, press **Create demo identities** to load sample DIDs that showcase roles, notes, and authorized sites. / 初次使用时，可点击 **Create demo identities 生成示例身份** 加载包含角色、备注与示例授权站点的样例数据。

## Development｜开发

The extension is built with Manifest V3 and plain JavaScript. You can customize it by editing the files inside the `extension/` directory. No build step is required – reload the extension in Chrome after saving changes.

该扩展基于 Manifest V3 和原生 JavaScript 开发，可通过修改 `extension/` 目录下的文件实现自定义。无需构建流程，保存后在 Chrome 扩展页点击“重新加载”即可。

## License｜许可证

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

本项目以 MIT 许可证开源，详见 [LICENSE](LICENSE)。

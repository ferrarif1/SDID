# SDID – 身份管理 Chrome 扩展 🚀

[English README](README.md)

SDID 是一个 Chrome 浏览器扩展，帮助团队在无密码或通行密钥优先的场景下管理去中心化身份。你可以生成 DID 密钥对、为登录挑战签名、保存备用凭据，并在工具栏上一键审批 dapp 请求。

![演示 GIF](images/1.gif)

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
  <img alt="Chrome" src="https://img.shields.io/badge/Chrome-MV3-blue">
  <img alt="Web Crypto" src="https://img.shields.io/badge/Web%20Crypto-P256%20ECDSA-orange">
  <img alt="状态" src="https://img.shields.io/badge/状态-Alpha-yellow">
</p>

## 功能特点 ✨

- DID 密钥管理与签名：为每个身份生成 P-256 密钥对，公开 DID，并为去中心化应用的登录挑战生成签名。
- 站点授权控制：记住已授权的站点以便下次一键登录，也可在选项页随时撤销。
- 角色与标签元数据：记录角色、域名、标签和备注，清晰表达权限范围与使用说明。
- 安全存储与备份：身份数据（包含密钥）保存在受加密保护的 Chrome 同步存储中，并支持 JSON 导入导出备份。
- 表单自动填充备援：可为传统系统保存备用用户名与密码，并在当前页面一键填充。
- 可验证的 DID 授权凭证：登录响应附带规范化负载与 W3C 风格的证明对象，方便接入方验证签名者与签名内容。
- 语言切换：弹窗、选项页与确认覆盖层均可一键切换中英文，界面即时更新。
- 纯色线条界面：参考 Google 与 Apple 的设计语言，界面以纯色与线条为主，排版简洁、层次清晰。
- 演示应用：`/demo` 目录提供可直接运行的站点，用于发起 SDID 登录并验证返回的签名。

## 快速确认登录流程 ⚡

网页应用可以直接在页面上下文中调用 SDID，并获得与常见钱包连接类似的快速确认体验。弹窗会展示身份名称、角色与 DID 详情，用户可选择记住当前站点。确认后，SDID 会生成经过规范化的认证负载，用该身份的私钥签名并附上符合 W3C 规范的证明对象，同时在检测到用户名或密码输入框时自动填充。

### 在网页应用中发起登录请求

1. 请确认已安装 SDID 扩展并保存至少一个身份。
2. 在网页中调用 `window.SDID.requestLogin()`，传入挑战字符串及可选的提示信息或期望使用的身份 ID。
3. 等待 Promise 结果：成功时会返回经过处理的身份信息、挑战消息的 base64 签名、自动填充状态及授权信息；失败表示用户取消或拒绝了请求。

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
      // response.fill 包含传统表单的自动填充状态
    } catch (error) {
      console.error('SDID login denied', error);
    }
  }
  // connectToSdid();
</script>
```

> 💡 提示：请求/响应基于 `window.postMessage` 实现。若自行构建桥接逻辑，请仅处理 `event.data.type === 'SDID_LOGIN_RESULT'` 的事件。桥接脚本加载完成后会触发 `sdid#initialized` 事件，应用可在调用 `requestLogin` 前等待 `window.SDID` 就绪。

### 演示站点 🧪

仓库内置的 [`demo/`](demo) 目录提供了一个静态演示站点，可用于生成挑战、发起授权并验证返回的签名。

在 `demo` 目录下启动任意静态文件服务器，并在加载了扩展的 Chrome 中打开该站点：

```bash
npx serve demo
# 或
python -m http.server --directory demo
```

点击“Connect with SDID”按钮触发审批流程，页面会展示返回的身份信息以及签名是否可通过给定挑战验证。

## 快速开始 🛠️

1. 在 Chrome 中打开 `chrome://extensions/`。
2. 在右上角启用“开发者模式”。
3. 点击“加载已解压的扩展程序”并选择仓库中的 `extension` 目录。
4. 将“SDID Identity Manager”扩展固定到浏览器工具栏，方便快速使用。
5. 在 dApp 页面点击 SDID 图标，按下“为此站点启用”以授予运行时权限并立即注入 DID 桥接脚本。

## 身份管理 👤

- 通过工具栏弹窗搜索身份、复制 DID 或公钥、一键填充传统凭据，并可随时撤销当前站点授权。
- 点击弹窗中的“管理”（或右键扩展图标选择“选项”）以创建身份、生成或轮换 DID 密钥、查看/复制私钥，并审查每个站点的授权记录。
- 初次使用时，可点击“生成示例身份”加载包含角色、备注与示例授权站点的样例数据。

## 开发 🧰

该扩展基于 Manifest V3 和原生 JavaScript 开发，可通过修改 `extension/` 目录下的文件实现自定义。无需构建流程，保存后在 Chrome 扩展页点击“重新加载”即可。

## 许可证 📄

本项目以 MIT 许可证开源，详见 [LICENSE](LICENSE)。

---

## 为什么选择 SDID？🤔

- 保有密钥所有权，自主决定披露范围。
- 同时适配现代通行密钥站点与传统表单场景。
- 代码体量小、可审计、权限最小化。

如果你喜欢这个项目，欢迎点亮一颗 ⭐，让更多人看到它！

---

## 架构

SDID 基于 Chrome Manifest V3 与 Web Crypto API，注重最小权限与隐私保护。

- 核心组件
  - 后台 Service Worker：作为长期运行的中枢，负责密钥管理、站点授权与消息分发。
  - 内容脚本：向网页注入精简桥接代码，使页面可通过 `window.SDID` 调用扩展能力。
  - 页面桥 `pageBridge.js`：运行在页面上下文，通过 `postMessage` 与扩展通信。
  - 弹窗 UI：快速检索身份、复制 DID、公钥，执行表单填充与站点授权/撤销。
  - 选项页：身份与密钥的完整管理、导入导出、元数据编辑、按站点审计记录。

- 数据流
  1. 网页调用 `window.SDID.requestLogin()` 传入挑战字符串。
  2. 桥接将请求转发至后台逻辑。
  3. 用户在确认面板中选择身份并授权。
  4. 后台对载荷进行规范化，使用所选身份私钥签名，返回证明与最小化的身份元数据。
  5. 可选：若配置了传统凭据，内容脚本尝试自动填充表单。

- 存储
  - 使用 Chrome 同步存储（由 Chrome 负责静态加密）保存身份、密钥与设置。
  - 支持 JSON 导入导出，便于备份与迁移。

## 设计原则

- 最小权限：仅在用户为站点显式启用后注入，避免广域权限。
- 可验证优先：认证载荷标准化并附带明确的证明对象。
- 密钥可迁移：仅在用户明确操作下导入导出 JSON。
- 上下文隔离：页面、内容脚本与扩展之间通过明确消息通道通信。

## API 参考

扩展在被站点启用后，会在页面层暴露精简 API。

### `window.SDID.requestLogin(options)`

- 参数
  - `challenge`（必填，string）：由接入方提供的不透明挑战字符串。
  - `message`（可选，string）：用于审批界面的友好提示。
  - `preferredIdentityId`（可选，string）：建议使用的身份 ID。

- 返回（Promise）
  - `identity`：最小化身份元数据（id、name、did、publicKeyJwk、tags）。
  - `signature`（base64）：针对规范化请求字符串的 ECDSA P-256 签名。
  - `authentication`：`{ canonicalRequest, payload }`，便于可重复验证。
  - `proof`：W3C 风格的证明对象，包含类型、算法与创建时间等。
  - `fill`：传统表单自动填充状态（如适用）。

- 错误
  - 用户取消或拒绝。
  - 站点未授权。
  - 请求格式不合法。

验证示例可参考上文“快速确认登录流程”中的代码片段。

## 安全模型

- 密钥材料：本地生成与存储，使用 Web Crypto；除非用户显式导出，私钥不会离开扩展。
- 授权模型：按来源（origin）记忆授权，用户可在选项页随时撤销。
- 规范化：认证载荷进行规范化，避免字段顺序差异导致的签名歧义与复用。
- 隔离性：页面代码无法直接访问扩展内部，仅能通过 `postMessage` 公开的最小 API 交互。
- 备份卫生：导出为纯 JSON，视同敏感材料妥善保管。

## 安装与使用

1. 在 `chrome://extensions`（开发者模式）中从 `extension/` 目录加载未打包扩展。
2. 在“选项”页创建一个或多个身份；或从 JSON 导入。
3. 打开网站（或内置 demo），点击工具栏图标，为该站点启用扩展。
4. 在站点端调用 `window.SDID.requestLogin()` 触发授权流程。

## 疑难解答

- 页面中 `window.SDID` 不存在
  - 请先在弹窗中为该站点点击“为此站点启用”，然后刷新页面。

- 签名验证失败
  - 使用返回的 `authentication.canonicalRequest` 重建完全一致的字符串。
  - 导入 JWK 时确保参数为 `{ name: 'ECDSA', namedCurve: 'P-256' }` 且使用 SHA-256。

- 弹窗未显示身份
  - 在“选项”页检查是否已创建身份。
  - 若通过 JSON 导入，确认结构符合预期。

## 路线图

- 对非 DID 站点的可选 Passkey（WebAuthn）桥接。
- 引入更多密钥算法（如 Ed25519），以兼容不同生态。
- 在可用硬件上为身份使用硬件保护的密钥。
- 更细粒度的站点授权范围与数据披露控制。

## 参与贡献

欢迎贡献！建议：

- 对重大改动先提交 issue 讨论方案。
- PR 保持聚焦、描述清晰。
- 遵循现有代码风格，避免无关重构。

## 常见问题（FAQ）

- 为什么选择 DID 而不是仅使用 Passkey？
  - DID 提供可在多环境复用的可验证标识与签名，而 Passkey 更偏向于 WebAuthn/RP 模式。SDID 强调可验证与可移植的认证产物。

- 数据是否会在多设备间同步？
  - 若启用 Chrome 同步，则会在设备间同步。导出文件请视为敏感备份妥善保存。

- 站点是否可通过 DID 跟踪我？
  - 建议按场景/域名使用不同身份，避免不必要的可关联性。



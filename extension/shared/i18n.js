const LANGUAGE_STORAGE_KEY = 'sdidLanguage';
export const SUPPORTED_LANGUAGES = ['en', 'zh'];
const DEFAULT_LANGUAGE = 'en';

const translations = {
  en: {
    common: {
      appName: 'SDID Identity Manager',
      confirm: 'Confirm',
      cancel: 'Cancel',
      deleteAll: 'Delete all',
      manage: 'Manage',
      show: 'Show',
      hide: 'Hide',
      generateDid: 'Generate DID',
      generating: 'Generating…',
      copy: 'Copy',
      saveIdentity: 'Save identity',
      languageLabel: 'Language',
      languageEnglish: 'English',
      languageChinese: '中文',
      untitledIdentity: 'Untitled identity'
    },
    options: {
      subtitle: 'Create decentralized identities, manage roles, and approve dapp logins in one place.',
      actions: {
        createDemo: 'Create demo identities',
        exportJson: 'Export JSON',
        importJson: 'Import JSON',
        clearAll: 'Clear all'
      },
      form: {
        createTitle: 'Create DID identity',
        editTitle: 'Edit DID identity',
        displayName: 'Display name',
        displayNamePlaceholder: 'e.g. Operations Admin',
        roles: 'Roles',
        rolesPlaceholder: 'Comma separated roles',
        rolesHint: 'Roles help dapps determine permissions.',
        domain: 'Trusted domain',
        domainPlaceholder: 'https://app.example.com',
        domainHint: 'Optional hint about where this identity is used.',
        username: 'Username / Email',
        usernamePlaceholder: 'Optional fallback login name',
        password: 'Password / Passcode',
        passwordPlaceholder: 'Optional fallback secret',
        tags: 'Tags',
        tagsPlaceholder: 'Comma separated tags',
        notes: 'Notes',
        notesPlaceholder: 'Add approval rules, recovery tips, or reminders.',
        didLabel: 'Decentralized ID (DID)',
        didPlaceholder: 'Generate a DID before saving',
        didHint: 'Generates a new elliptic-curve key pair and DID for signing login requests.',
        publicKeyLabel: 'Public key (JWK)',
        publicKeyPlaceholder: 'Generate DID to view public key',
        privateKeyLabel: 'Private key (JWK)',
        privateKeyPlaceholder: 'Generate DID to view private key',
        privateKeyHint: 'Keep the private key secure and never share it with untrusted parties.'
      },
      collection: {
        title: 'Saved identities',
        empty: 'No identities saved yet. Use the form above to add your first decentralized identity.',
        meta: {
          roles: 'Roles:',
          did: 'DID:',
          username: 'Username:',
          domain: 'Trusted domain:'
        },
        authorizedSites: 'Authorized sites',
        lastUsed: 'Last used:',
        revoke: 'Revoke',
        edit: 'Edit',
        duplicate: 'Duplicate',
        delete: 'Delete',
        copySuffix: ' (copy)'
      },
      confirmClear: {
        title: 'Remove all identities?',
        message: 'This cannot be undone. Make sure you exported a backup first.',
        cancel: 'Cancel',
        confirm: 'Delete all'
      },
      roles: {
        none: 'No role assigned'
      },
      notifications: {
        generated: 'Generated new DID and key pair.',
        generateFailed: 'Failed to generate DID. Please ensure Web Crypto is available.',
        duplicateSuccess: 'Duplicated identity with new DID.',
        duplicateError: 'Unable to duplicate identity.',
        deleted: 'Deleted identity.',
        revoked: 'Revoked authorization.',
        requireDidBeforeSave: 'Generate a DID before saving.',
        displayNameRequired: 'Display name is required.',
        saved: 'Identity saved.',
        clearBeforeDemo: 'Clear existing identities before creating demos.',
        demoCreated: 'Demo identities created.',
        demoFailed: 'Unable to create demo identities.',
        noExport: 'No identities to export yet.',
        copyJson: 'Copied JSON to clipboard.',
        copyJsonError: 'Unable to copy JSON. Please allow clipboard permissions.',
        imported: 'Imported {count} identities.',
        importFailed: 'Import failed. Please select a valid JSON export.',
        needDidFirst: 'Generate a DID first.',
        copyPrivateKey: 'Copied private key to clipboard.',
        copyPrivateKeyError: 'Unable to copy private key.'
      },
      demo: {
        labels: {
          operationsAdmin: 'Operations Admin',
          financeSigner: 'Finance Signer',
          developerSandbox: 'Developer Sandbox'
        },
        notes: {
          operationsAdmin: 'Full access to internal console with approval powers.',
          financeSigner: 'Use for invoice approvals and settlement workflows.',
          developerSandbox: 'Grants access to pre-production integrations.'
        }
      }
    },
    popup: {
      subtitle: 'Decentralized Identity Vault',
      searchLabel: 'Find DID identity',
      searchPlaceholder: 'Search by name, DID, role or domain',
      empty: 'No decentralized identities yet. Create one to start approving dapp logins.',
      createFirst: 'Create identity',
      meta: {
        domain: 'Trusted domain:',
        roles: 'Roles:',
        did: 'DID:',
        tags: 'Tags:'
      },
      status: {
        authorized: 'Authorized for this site',
        unauthorized: 'Not yet authorized for this site',
        revokedSuccess: 'Revoked current site authorization.',
        revokedError: 'Unable to revoke authorization.',
        filling: 'Filling identity…',
        noTab: 'No active tab available.',
        unableFill: 'Unable to fill identity on this page.',
        filled: 'Filled {label}',
        noDid: 'This identity does not have a DID yet.',
        copiedDid: 'Copied DID to clipboard.',
        copyDidError: 'Unable to copy DID.',
        noPublicKey: 'No public key available.',
        copiedPublicKey: 'Copied public key JSON.',
        copyPublicKeyError: 'Unable to copy public key.'
      },
      actions: {
        manage: 'Manage',
        copyDid: 'Copy DID',
        copyPublicKey: 'Copy public key',
        autofill: 'Autofill login',
        revokeSite: 'Revoke site'
      }
    },
    content: {
      errors: {
        missingIdentity: 'Missing identity payload.',
        usernameFillFailed: 'Unable to populate username field.',
        usernameMissing: 'No username field detected on this page.',
        passwordFillFailed: 'Unable to populate password field.',
        passwordMissing: 'No password field detected on this page.',
        noCredentials: 'Identity does not contain username or password values to fill.',
        alreadyPending: 'Another login request is already pending. Please complete it first.',
        noIdentities: 'No eligible DID identities are saved in SDID.',
        identityNotFound: 'The selected identity could not be located.',
        loginCancelled: 'Login request cancelled by user.',
        loginFailed: 'Login request failed.'
      },
      overlay: {
        title: 'SDID login request',
        origin: 'Origin:',
        chooseIdentity: 'Choose identity',
        remember: 'Remember this site for one-click approvals',
        rememberAuthorized: 'This site is already authorized. Uncheck to require approval next time.',
        rememberHint: 'Keep this checked to approve future logins instantly.',
        summaryIdentity: 'Identity:',
        summaryDid: 'DID:',
        summaryRoles: 'Roles:',
        summaryDomain: 'Trusted domain:',
        summaryUsername: 'Username:',
        summaryNotes: 'Notes:'
      }
    }
  },
  zh: {
    common: {
      appName: 'SDID 身份管理器',
      confirm: '确认',
      cancel: '取消',
      deleteAll: '全部删除',
      manage: '管理',
      show: '显示',
      hide: '隐藏',
      generateDid: '生成 DID',
      generating: '正在生成…',
      copy: '复制',
      saveIdentity: '保存身份',
      languageLabel: '语言',
      languageEnglish: 'English',
      languageChinese: '中文',
      untitledIdentity: '未命名身份'
    },
    options: {
      subtitle: '集中创建去中心化身份、管理角色并审批去中心化应用的登录请求。',
      actions: {
        createDemo: '生成示例身份',
        exportJson: '导出 JSON',
        importJson: '导入 JSON',
        clearAll: '清空全部'
      },
      form: {
        createTitle: '创建 DID 身份',
        editTitle: '编辑 DID 身份',
        displayName: '显示名称',
        displayNamePlaceholder: '示例：运营管理员',
        roles: '角色',
        rolesPlaceholder: '多个角色请用逗号分隔',
        rolesHint: '角色用于帮助去中心化应用判断权限范围。',
        domain: '信任域名',
        domainPlaceholder: 'https://app.example.com',
        domainHint: '可选：用于说明身份适用的域名。',
        username: '用户名 / 邮箱',
        usernamePlaceholder: '可选备用登录名',
        password: '密码 / 口令',
        passwordPlaceholder: '可选备用口令',
        tags: '标签',
        tagsPlaceholder: '使用逗号分隔多个标签',
        notes: '备注',
        notesPlaceholder: '可记录审批规则、恢复提示或其他备注。',
        didLabel: '去中心化身份标识 (DID)',
        didPlaceholder: '保存前请生成 DID',
        didHint: '生成新的椭圆曲线密钥对和 DID，用于签名登录请求。',
        publicKeyLabel: '公钥 (JWK)',
        publicKeyPlaceholder: '生成 DID 后可查看公钥',
        privateKeyLabel: '私钥 (JWK)',
        privateKeyPlaceholder: '生成 DID 后可查看私钥',
        privateKeyHint: '请妥善保管私钥，勿向不可信的对象泄露。'
      },
      collection: {
        title: '已保存的身份',
        empty: '还没有保存任何身份，请使用上方表单创建首个去中心化身份。',
        meta: {
          roles: '角色：',
          did: 'DID：',
          username: '用户名：',
          domain: '信任域名：'
        },
        authorizedSites: '已授权站点',
        lastUsed: '最近使用：',
        revoke: '撤销',
        edit: '编辑',
        duplicate: '复制',
        delete: '删除',
        copySuffix: '（副本）'
      },
      confirmClear: {
        title: '确认删除所有身份？',
        message: '该操作无法撤销，请确保已提前导出备份。',
        cancel: '取消',
        confirm: '全部删除'
      },
      roles: {
        none: '未设置角色'
      },
      notifications: {
        generated: '已生成新的 DID 与密钥对。',
        generateFailed: '无法生成 DID，请确认浏览器支持 Web Crypto。',
        duplicateSuccess: '已复制身份并生成新的 DID。',
        duplicateError: '无法复制该身份。',
        deleted: '已删除身份。',
        revoked: '已撤销授权。',
        requireDidBeforeSave: '请先生成 DID 再保存。',
        displayNameRequired: '显示名称不能为空。',
        saved: '身份已保存。',
        clearBeforeDemo: '请先清空现有身份后再生成示例数据。',
        demoCreated: '已生成示例身份。',
        demoFailed: '无法生成示例身份。',
        noExport: '暂时没有可导出的身份。',
        copyJson: '已复制 JSON 到剪贴板。',
        copyJsonError: '无法复制 JSON，请允许剪贴板权限。',
        imported: '已导入 {count} 个身份。',
        importFailed: '导入失败，请选择有效的 JSON 备份。',
        needDidFirst: '请先生成 DID。',
        copyPrivateKey: '已复制私钥。',
        copyPrivateKeyError: '无法复制私钥。'
      },
      demo: {
        labels: {
          operationsAdmin: '运营管理员',
          financeSigner: '财务签署人',
          developerSandbox: '开发者沙箱'
        },
        notes: {
          operationsAdmin: '拥有内部控制台完全访问权限，可审批关键操作。',
          financeSigner: '用于发票审批与结算流程。',
          developerSandbox: '用于访问预生产集成环境。'
        }
      }
    },
    popup: {
      subtitle: '去中心化身份保管库',
      searchLabel: '搜索 DID 身份',
      searchPlaceholder: '支持名称、DID、角色或域名搜索',
      empty: '还没有去中心化身份，请先创建以便审批 dapp 登录请求。',
      createFirst: '新建身份',
      meta: {
        domain: '信任域名：',
        roles: '角色：',
        did: 'DID：',
        tags: '标签：'
      },
      status: {
        authorized: '已授权当前站点',
        unauthorized: '尚未授权当前站点',
        revokedSuccess: '已撤销当前站点授权。',
        revokedError: '无法撤销授权。',
        filling: '正在填充登录信息…',
        noTab: '当前没有可用的浏览器标签页。',
        unableFill: '无法在此页面填充身份信息。',
        filled: '已填充 {label}',
        noDid: '该身份尚未生成 DID。',
        copiedDid: '已复制 DID。',
        copyDidError: '无法复制 DID。',
        noPublicKey: '没有可用的公钥。',
        copiedPublicKey: '已复制公钥 JSON。',
        copyPublicKeyError: '无法复制公钥。'
      },
      actions: {
        manage: '管理',
        copyDid: '复制 DID',
        copyPublicKey: '复制公钥',
        autofill: '自动填充登录',
        revokeSite: '撤销站点'
      }
    },
    content: {
      errors: {
        missingIdentity: '缺少身份数据。',
        usernameFillFailed: '无法填充用户名输入框。',
        usernameMissing: '未在页面上检测到用户名输入框。',
        passwordFillFailed: '无法填充密码输入框。',
        passwordMissing: '未在页面上检测到密码输入框。',
        noCredentials: '该身份未包含可用于填充的用户名或密码。',
        alreadyPending: '已有其他登录请求正在等待处理，请先完成。',
        noIdentities: 'SDID 中尚未保存可用的 DID 身份。',
        identityNotFound: '未找到所选择的身份。',
        loginCancelled: '用户已取消登录请求。',
        loginFailed: '登录请求处理失败。'
      },
      overlay: {
        title: 'SDID 登录请求',
        origin: '请求来源：',
        chooseIdentity: '选择登录身份',
        remember: '记住此站点，下次一键授权',
        rememberAuthorized: '当前站点已授权，取消勾选则下次重新确认。',
        rememberHint: '保持勾选以便下次自动快速授权。',
        summaryIdentity: '身份：',
        summaryDid: 'DID：',
        summaryRoles: '角色：',
        summaryDomain: '信任域名：',
        summaryUsername: '用户名：',
        summaryNotes: '备注：'
      }
    }
  }
};

const listeners = new Set();
let currentLanguage = DEFAULT_LANGUAGE;
let initialized = false;

function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const lang = navigator.language || navigator.userLanguage || '';
  if (lang && lang.toLowerCase().startsWith('zh')) {
    return 'zh';
  }
  return DEFAULT_LANGUAGE;
}

function sanitizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

function getFromDictionary(language, key) {
  const parts = key.split('.');
  let node = translations[language];
  for (const part of parts) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : null;
}

function formatTemplate(template, replacements = {}) {
  if (!replacements || typeof replacements !== 'object') {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    return token in replacements ? String(replacements[token]) : match;
  });
}

export function translate(key, replacements = {}, language = currentLanguage) {
  const lang = sanitizeLanguage(language);
  let template = getFromDictionary(lang, key);
  if (!template && lang !== DEFAULT_LANGUAGE) {
    template = getFromDictionary(DEFAULT_LANGUAGE, key);
  }
  if (!template) {
    console.warn('[i18n] Missing translation for key:', key);
    return key;
  }
  return formatTemplate(template, replacements);
}

function setDocumentLanguage(lang) {
  try {
    const doc = typeof document !== 'undefined' ? document : null;
    if (doc?.documentElement) {
      doc.documentElement.lang = lang;
    }
  } catch (error) {
    console.debug('Unable to set document language', error);
  }
}

async function loadStoredLanguage() {
  try {
    if (!chrome?.storage?.sync?.get) {
      return detectBrowserLanguage();
    }
    const stored = await chrome.storage.sync.get({ [LANGUAGE_STORAGE_KEY]: detectBrowserLanguage() });
    const value = stored?.[LANGUAGE_STORAGE_KEY];
    return sanitizeLanguage(typeof value === 'string' ? value : detectBrowserLanguage());
  } catch (_error) {
    return detectBrowserLanguage();
  }
}

function notifyListeners(lang) {
  for (const listener of listeners) {
    try {
      listener(lang);
    } catch (error) {
      console.error('Language listener error', error);
    }
  }
}

async function initialize() {
  if (initialized) {
    return currentLanguage;
  }
  const lang = await loadStoredLanguage();
  currentLanguage = lang;
  initialized = true;
  setDocumentLanguage(lang);
  notifyListeners(lang);
  return lang;
}

export const ready = initialize();

export function getLanguage() {
  return currentLanguage;
}

export async function setLanguage(language) {
  const lang = sanitizeLanguage(language);
  if (lang === currentLanguage) {
    return currentLanguage;
  }
  currentLanguage = lang;
  setDocumentLanguage(lang);
  notifyListeners(lang);
  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set({ [LANGUAGE_STORAGE_KEY]: lang });
    }
  } catch (error) {
    console.warn('Failed to persist language preference', error);
  }
  return currentLanguage;
}

export function onLanguageChange(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  if (initialized) {
    try {
      listener(currentLanguage);
    } catch (error) {
      console.error('Language listener error', error);
    }
  }
  return () => listeners.delete(listener);
}

export function applyTranslations(root = document, language = currentLanguage) {
  if (!root) {
    return;
  }
  const lang = sanitizeLanguage(language);
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    let args = {};
    const rawArgs = element.getAttribute('data-i18n-args');
    if (rawArgs) {
      try {
        args = JSON.parse(rawArgs);
      } catch (_error) {
        args = {};
      }
    }
    const text = translate(key, args, lang);
    const targets = element.getAttribute('data-i18n-target');
    if (!targets || targets.includes('text')) {
      element.textContent = text;
    }
    if (targets) {
      targets
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item && item !== 'text')
        .forEach((attr) => {
          element.setAttribute(attr, text);
        });
    }
  });
  setDocumentLanguage(lang);
}

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[LANGUAGE_STORAGE_KEY]) {
      return;
    }
    const nextValue = sanitizeLanguage(changes[LANGUAGE_STORAGE_KEY].newValue);
    if (nextValue && nextValue !== currentLanguage) {
      currentLanguage = nextValue;
      setDocumentLanguage(nextValue);
      notifyListeners(nextValue);
    }
  });
}

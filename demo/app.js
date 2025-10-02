const connectButton = document.getElementById('connect');
const forceButton = document.getElementById('force');
const statusElement = document.getElementById('status');
const identityElement = document.getElementById('identity');
const verificationElement = document.getElementById('verification');
const languageToggle = document.getElementById('language-toggle');
const languageButtons = languageToggle ? Array.from(languageToggle.querySelectorAll('button')) : [];
const approvalStatusElement = document.getElementById('approval-status');
const approvalListElement = document.getElementById('approval-list');
const submitApprovalButton = document.getElementById('submit-approval');
const approvalActionsElement = document.getElementById('approval-actions');
const approvalsCardElement = document.getElementById('approvals-card');

const LANGUAGE_STORAGE_KEY = 'sdid-demo-language';
const SUPPORTED_LANGUAGES = ['en', 'zh'];
const APPROVAL_STORAGE_KEY = 'sdid-demo-approvals';

const translations = {
  en: {
    page: { title: 'SDID Demo dApp' },
    language: { label: 'Language' },
    hero: {
      title: 'SDID Demo dApp',
      subtitle:
        'Connect to the SDID browser extension, approve the login request, and verify the DID signature returned to this page.'
    },
    steps: {
      title: 'How it works',
      step1: 'Install the SDID extension and create at least one DID identity.',
      step2: 'Click “Connect with SDID” to send a login request to the extension.',
      step3: 'Approve the wallet-style prompt and optionally remember this site for next time.',
      step4: 'The demo verifies the signature using the returned public key.'
    },
    actions: {
      title: 'Try it now',
      connect: 'Connect with SDID',
      force: 'Force prompt',
      hint: 'If you previously authorized this site, use “Force prompt” to see the approval dialog again.'
    },
    sections: {
      identity: 'Identity response',
      verification: 'Signature verification'
    },
    footer: {
      note: 'Reload the extension after editing source files to pick up changes.'
    },
    status: {
      waiting: 'Waiting for the SDID extension…',
      ready: 'SDID ready. Click connect to begin.',
      connecting: 'Requesting approval…',
      connected: 'Connected as {label}',
      rejected: 'Login was rejected.',
      error: 'Unable to complete the login request.'
    },
    verification: {
      missing: 'Missing public key or signature.',
      success: 'Signature verified successfully.',
      failure: 'Signature verification failed.',
      error: 'Unable to verify the signature. Check the console for details.',
      mismatch: 'Authentication payload mismatch.',
      insecureContext:
        'This page is running on an insecure origin, so the browser cannot verify signatures locally.'
    },
    approvals: {
      title: 'Identity approvals',
      status: {
        disconnected: 'Connect with SDID to manage identity approvals.',
        admin: 'Signed in as administrator {label}. Review pending requests below.',
        notSubmitted: 'No approval request has been submitted for this identity.',
        pending: 'Approval submitted on {date}. Waiting for an administrator signature.',
        approved: 'Certified on {date} by {approver}.'
      },
      actions: {
        submit: 'Submit approval request',
        approve: 'Approve',
        approving: 'Requesting administrator signature…',
        approved: '{label} approved successfully.',
        submitted: 'Approval request submitted for {label}.',
        error: 'Unable to complete the approval.'
      },
      list: {
        headerApplicant: 'Applicant',
        headerRoles: 'Roles',
        headerCreated: 'Submitted',
        headerStatus: 'Status',
        headerActions: 'Actions',
        statusPending: 'Pending',
        statusApproved: 'Approved',
        empty: 'No approval requests yet.'
      },
      prompts: {
        approveMessage: 'Approve identity {label}'
      },
      errors: {
        submissionUnavailable: 'Connect with SDID before submitting an approval request.',
        alreadySubmitted: 'An approval request has already been submitted for this identity.',
        adminOnly: 'Administrator approval is required.'
      },
      verification: {
        pending: 'Identity approval is still pending administrator review.',
        missing: 'Identity has not been approved by an administrator.',
        adminOnly: 'Administrator approval signature required.'
      },
      card: {
        submitted: 'Submitted: {date}',
        approved: 'Approved: {date}',
        approver: 'Approved by {approver}'
      }
    },
    login: {
      message: 'Demo dApp requests access'
    },
    labels: {
      unknownIdentity: 'unknown identity'
    }
  },
  zh: {
    page: { title: 'SDID 演示应用' },
    language: { label: '语言' },
    hero: {
      title: 'SDID 演示应用',
      subtitle: '连接 SDID 浏览器扩展，确认登录请求，并在此页面验证返回的 DID 签名。'
    },
    steps: {
      title: '操作流程',
      step1: '安装 SDID 扩展并创建至少一个 DID 身份。',
      step2: '点击“连接 SDID”向扩展发送登录请求。',
      step3: '在类似钱包的确认弹窗中授权，可选择记住此站点以便下次快速通过。',
      step4: '演示应用会使用返回的公钥验证签名。'
    },
    actions: {
      title: '立即体验',
      connect: '连接 SDID',
      force: '强制弹窗',
      hint: '如果之前已授权此站点，可点击“强制弹窗”再次查看确认流程。'
    },
    sections: {
      identity: '身份返回结果',
      verification: '签名验证'
    },
    footer: {
      note: '修改源码后请在 Chrome 扩展页面重新加载以应用更改。'
    },
    status: {
      waiting: '正在等待 SDID 扩展…',
      ready: 'SDID 已就绪，点击按钮开始体验。',
      connecting: '正在请求授权…',
      connected: '已连接身份：{label}',
      rejected: '登录请求被拒绝。',
      error: '登录请求未能完成。'
    },
    verification: {
      missing: '缺少公钥或签名。',
      success: '签名验证通过。',
      failure: '签名验证失败。',
      error: '无法验证签名，请查看控制台日志。',
      mismatch: '认证负载不一致。',
      insecureContext: '当前页面非安全来源，浏览器无法在本地验证签名。'
    },
    approvals: {
      title: '身份审批',
      status: {
        disconnected: '请先连接 SDID 以管理身份审批。',
        admin: '已使用管理员身份 {label} 登录，可在下方审批待处理请求。',
        notSubmitted: '当前身份尚未提交审批请求。',
        pending: '已于 {date} 提交审批，等待管理员签名。',
        approved: '已于 {date} 由 {approver} 完成认证。'
      },
      actions: {
        submit: '提交审批请求',
        approve: '签名审批',
        approving: '正在请求管理员签名…',
        approved: '{label} 已通过审批。',
        submitted: '已为 {label} 提交审批请求。',
        error: '审批流程未能完成。'
      },
      list: {
        headerApplicant: '申请人',
        headerRoles: '角色',
        headerCreated: '提交时间',
        headerStatus: '状态',
        headerActions: '操作',
        statusPending: '待审批',
        statusApproved: '已通过',
        empty: '暂无审批请求。'
      },
      prompts: {
        approveMessage: '审批身份 {label}'
      },
      errors: {
        submissionUnavailable: '请先连接 SDID 再提交审批请求。',
        alreadySubmitted: '当前身份已提交审批请求。',
        adminOnly: '需要管理员身份才能执行审批。'
      },
      verification: {
        pending: '身份审批仍在等待管理员审核。',
        missing: '该身份尚未获得管理员认证。',
        adminOnly: '必须由管理员签名确认审批。'
      },
      card: {
        submitted: '提交时间：{date}',
        approved: '通过时间：{date}',
        approver: '审批人：{approver}'
      }
    },
    login: {
      message: '演示应用请求访问'
    },
    labels: {
      unknownIdentity: '未知身份'
    }
  }
};

let currentLanguage = 'en';
let lastStatus = { key: null, replacements: null, message: '', tone: 'info' };
let lastVerification = null;
let approvalsState = loadApprovals();
let currentIdentityResponse = null;
let lastCertification = { status: 'disconnected', approval: null };

function sanitizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : 'en';
}

function detectLanguage() {
  const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

function getFromDictionary(language, key) {
  const segments = key.split('.');
  let node = translations[language];
  for (const segment of segments) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    node = node[segment];
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

function canonicalizeJson(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function translate(key, replacements = {}, language = currentLanguage) {
  const lang = sanitizeLanguage(language);
  let template = getFromDictionary(lang, key);
  if (!template && lang !== 'en') {
    template = getFromDictionary('en', key);
  }
  if (!template) {
    return key;
  }
  return formatTemplate(template, replacements);
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles
    .map((role) => (typeof role === 'string' ? role.trim() : ''))
    .filter(Boolean);
}

function isAdminIdentity(identity) {
  if (!identity) {
    return false;
  }
  return normalizeRoles(identity.roles).some((role) => role.toLowerCase() === 'admin');
}

function normalizeApprovalRecord(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const id = typeof raw.id === 'string' ? raw.id : null;
  const applicantDid = typeof raw.applicantDid === 'string' ? raw.applicantDid : null;
  if (!id || !applicantDid) {
    return null;
  }
  return {
    id,
    applicantDid,
    applicantLabel: typeof raw.applicantLabel === 'string' ? raw.applicantLabel : '',
    applicantRoles: normalizeRoles(raw.applicantRoles || raw.roles),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    status: raw.status === 'approved' ? 'approved' : 'pending',
    approvedAt: typeof raw.approvedAt === 'string' ? raw.approvedAt : null,
    approverDid: typeof raw.approverDid === 'string' ? raw.approverDid : null,
    approverLabel: typeof raw.approverLabel === 'string' ? raw.approverLabel : null,
    approverRoles: normalizeRoles(raw.approverRoles),
    approvalChallenge: typeof raw.approvalChallenge === 'string' ? raw.approvalChallenge : null,
    approvalSignature: typeof raw.approvalSignature === 'string' ? raw.approvalSignature : null
  };
}

function loadApprovals() {
  let raw = null;
  try {
    raw = localStorage.getItem(APPROVAL_STORAGE_KEY);
  } catch (_error) {
    raw = null;
  }
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeApprovalRecord(item))
      .filter((item) => item !== null);
  } catch (_error) {
    return [];
  }
}

function saveApprovals(list) {
  try {
    localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn('Unable to persist approvals', error);
  }
}

function updateApprovals(nextList) {
  approvalsState = Array.isArray(nextList) ? nextList : [];
  saveApprovals(approvalsState);
  renderApprovalUI();
}

function generateApprovalId() {
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  return `approval-${Date.now().toString(16)}-${randomValue}`;
}

function getCertificationState(identity) {
  if (!identity || !identity.did) {
    return { status: 'disconnected', approval: null };
  }
  if (isAdminIdentity(identity)) {
    return { status: 'admin', approval: null };
  }
  const matches = approvalsState.filter((item) => item.applicantDid === identity.did);
  if (!matches.length) {
    return { status: 'missing', approval: null };
  }
  const approved = matches
    .filter((item) => item.status === 'approved')
    .sort((a, b) => {
      const aTime = Date.parse(a.approvedAt || a.createdAt || 0);
      const bTime = Date.parse(b.approvedAt || b.createdAt || 0);
      return bTime - aTime;
    })[0];
  if (approved) {
    return { status: 'approved', approval: approved };
  }
  const pending = matches
    .filter((item) => item.status !== 'approved')
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))[0];
  if (pending) {
    return { status: 'pending', approval: pending };
  }
  return { status: 'missing', approval: null };
}

function formatRolesList(roles) {
  const normalized = normalizeRoles(roles);
  return normalized.length ? normalized.join(', ') : '—';
}

function shortenIdentifier(value, { prefixLength = 10, suffixLength = 6 } = {}) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= prefixLength + suffixLength + 1) {
    return trimmed;
  }
  return `${trimmed.slice(0, prefixLength)}…${trimmed.slice(-suffixLength)}`;
}

function formatTimestamp(value) {
  if (!value) {
    return '—';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    return formatter.format(date);
  } catch (_error) {
    return '—';
  }
}

function formatApplicantLabel(request) {
  const label = (request?.applicantLabel || '').trim();
  const did = request?.applicantDid || '';
  if (label && did && label !== did) {
    return `${label} (${did})`;
  }
  return label || did || translate('labels.unknownIdentity');
}

function formatApproverName(request) {
  const label = (request?.approverLabel || '').trim();
  if (label) {
    return label;
  }
  return request?.approverDid || translate('labels.unknownIdentity');
}

function createApplicantCard(request) {
  const card = document.createElement('div');
  card.className = 'approval-card';

  const title = document.createElement('strong');
  title.textContent = formatApplicantLabel(request);
  card.appendChild(title);

  if (
    request.applicantLabel &&
    request.applicantDid &&
    request.applicantLabel.trim() &&
    request.applicantLabel.trim() !== request.applicantDid
  ) {
    const didLine = document.createElement('small');
    didLine.className = 'muted identifier';
    didLine.textContent = shortenIdentifier(request.applicantDid);
    didLine.title = request.applicantDid;
    card.appendChild(didLine);
  }

  const rolesLine = document.createElement('span');
  rolesLine.textContent = `${translate('approvals.list.headerRoles')}: ${formatRolesList(
    request.applicantRoles
  )}`;
  card.appendChild(rolesLine);

  const submittedLine = document.createElement('span');
  submittedLine.textContent = translate('approvals.card.submitted', {
    date: formatTimestamp(request.createdAt)
  });
  card.appendChild(submittedLine);

  const statusLine = document.createElement('span');
  const statusKey = request.status === 'approved' ? 'approvals.list.statusApproved' : 'approvals.list.statusPending';
  statusLine.textContent = `${translate('approvals.list.headerStatus')}: ${translate(statusKey)}`;
  card.appendChild(statusLine);

  if (request.status === 'approved') {
    const approvedLine = document.createElement('span');
    approvedLine.textContent = translate('approvals.card.approved', {
      date: formatTimestamp(request.approvedAt || request.createdAt)
    });
    card.appendChild(approvedLine);

    const approverLine = document.createElement('span');
    approverLine.textContent = translate('approvals.card.approver', {
      approver: formatApproverName(request)
    });
    card.appendChild(approverLine);
  }

  return card;
}

function renderAdminApprovalList() {
  if (!approvalListElement) {
    return;
  }
  approvalListElement.innerHTML = '';
  const sorted = [...approvalsState].sort((a, b) => {
    if (a.status === b.status) {
      return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    }
    return a.status === 'pending' ? -1 : 1;
  });
  if (!sorted.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = translate('approvals.list.empty');
    approvalListElement.appendChild(emptyMessage);
    return;
  }

  const table = document.createElement('table');
  table.className = 'approval-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['headerApplicant', 'headerRoles', 'headerCreated', 'headerStatus', 'headerActions'].forEach((key) => {
    const th = document.createElement('th');
    th.textContent = translate(`approvals.list.${key}`);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  sorted.forEach((request) => {
    const row = document.createElement('tr');

    const applicantCell = document.createElement('td');
    const label = (request.applicantLabel || '').trim();
    if (label && request.applicantDid && label !== request.applicantDid) {
      const strong = document.createElement('strong');
      strong.textContent = label;
      applicantCell.appendChild(strong);

      const didLine = document.createElement('div');
      didLine.className = 'muted identifier';
      didLine.textContent = shortenIdentifier(request.applicantDid);
      didLine.title = request.applicantDid;
      applicantCell.appendChild(didLine);
      applicantCell.title = `${label} (${request.applicantDid})`;
    } else {
      const displayValue = request.applicantDid || label || translate('labels.unknownIdentity');
      applicantCell.textContent = shortenIdentifier(displayValue);
      applicantCell.title = displayValue;
    }
    row.appendChild(applicantCell);

    const rolesCell = document.createElement('td');
    rolesCell.textContent = formatRolesList(request.applicantRoles);
    row.appendChild(rolesCell);

    const createdCell = document.createElement('td');
    createdCell.textContent = formatTimestamp(request.createdAt);
    row.appendChild(createdCell);

    const statusCell = document.createElement('td');
    statusCell.className = 'status';
    const statusKey = request.status === 'approved' ? 'approvals.list.statusApproved' : 'approvals.list.statusPending';
    statusCell.textContent = translate(statusKey);
    row.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions';
    if (request.status === 'pending') {
      const approveButton = document.createElement('button');
      approveButton.type = 'button';
      approveButton.textContent = translate('approvals.actions.approve');
      approveButton.dataset.requestId = request.id;
      actionsCell.appendChild(approveButton);
    } else {
      actionsCell.textContent = '—';
    }
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  const wrapper = document.createElement('div');
  wrapper.className = 'approval-table-wrapper';
  wrapper.appendChild(table);
  approvalListElement.appendChild(wrapper);
}

function renderApprovalUI() {
  if (!approvalStatusElement || !approvalListElement) {
    return;
  }

  const identity = currentIdentityResponse?.identity || null;
  const certification = getCertificationState(identity);
  lastCertification = certification;

  approvalListElement.innerHTML = '';

  if (approvalsCardElement) {
    approvalsCardElement.classList.toggle('card--wide', certification.status === 'admin');
  }

  if (approvalActionsElement) {
    approvalActionsElement.hidden = true;
  }
  if (submitApprovalButton) {
    submitApprovalButton.disabled = true;
  }

  if (!identity) {
    approvalStatusElement.textContent = translate('approvals.status.disconnected');
    return;
  }

  const label =
    (identity.label && identity.label.trim()) || identity.did || translate('labels.unknownIdentity');

  if (certification.status === 'admin') {
    approvalStatusElement.textContent = translate('approvals.status.admin', { label });
    renderAdminApprovalList();
    return;
  }

  if (certification.status === 'missing' && approvalActionsElement && submitApprovalButton) {
    approvalActionsElement.hidden = false;
    submitApprovalButton.disabled = false;
  }

  if (certification.status === 'missing') {
    approvalStatusElement.textContent = translate('approvals.status.notSubmitted');
    return;
  }

  if (certification.status === 'pending') {
    const date = formatTimestamp(certification.approval?.createdAt);
    approvalStatusElement.textContent = translate('approvals.status.pending', { date });
    if (certification.approval) {
      approvalListElement.appendChild(createApplicantCard(certification.approval));
    }
    return;
  }

  if (certification.status === 'approved') {
    const date = formatTimestamp(certification.approval?.approvedAt || certification.approval?.createdAt);
    const approver = formatApproverName(certification.approval);
    approvalStatusElement.textContent = translate('approvals.status.approved', { date, approver });
    if (certification.approval) {
      approvalListElement.appendChild(createApplicantCard(certification.approval));
    }
    return;
  }

  approvalStatusElement.textContent = translate('approvals.status.notSubmitted');
}

function enforceCertification(response, verification) {
  const identity = response?.identity || null;
  const certification = getCertificationState(identity);
  lastCertification = certification;

  if (!identity) {
    return verification;
  }

  if (!verification?.verified) {
    return verification;
  }

  if (certification.status === 'admin' || certification.status === 'approved') {
    return verification;
  }

  if (certification.status === 'pending') {
    return { verified: false, key: 'approvals.verification.pending' };
  }

  return { verified: false, key: 'approvals.verification.missing' };
}

function applyTranslations(root = document) {
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    const targetsAttr = element.getAttribute('data-i18n-target');
    const targets = targetsAttr
      ? targetsAttr
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : ['text'];
    const text = translate(key);
    if (targets.includes('text')) {
      element.textContent = text;
    }
    targets
      .filter((target) => target !== 'text')
      .forEach((target) => {
        element.setAttribute(target, text);
      });
  });
  document.title = translate('page.title');
}

function updateLanguageToggleUI(language) {
  languageButtons.forEach((button) => {
    const value = button.dataset.language;
    const isActive = value === language;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function applyStatus() {
  if (!statusElement) {
    return;
  }
  const { key, replacements, message, tone } = lastStatus;
  const text = key ? translate(key, replacements) : message || '';
  statusElement.textContent = text;
  const state =
    tone === 'success' ? 'success' : tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'info';
  statusElement.dataset.state = state;
}

function setStatusFromKey(key, replacements = {}, tone = 'info') {
  lastStatus = { key, replacements, message: '', tone };
  applyStatus();
}

function setStatusMessage(message, tone = 'info') {
  lastStatus = { key: null, replacements: null, message: message || '', tone };
  applyStatus();
}

function applyVerification() {
  if (!verificationElement) {
    return;
  }
  verificationElement.innerHTML = '';
  if (!lastVerification) {
    return;
  }
  const { key, replacements, message, verified, severity } = lastVerification;
  const text = key ? translate(key, replacements) : message || '';
  if (!text) {
    return;
  }
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  const cssClass = severity || (verified ? 'success' : 'error');
  paragraph.className = cssClass;
  verificationElement.appendChild(paragraph);
}

function setVerification(result) {
  if (!verificationElement) {
    return;
  }
  if (!result) {
    lastVerification = null;
    applyVerification();
    return;
  }
  const severity = result.severity || (result.verified ? 'success' : 'error');
  lastVerification = {
    key: result.key || null,
    replacements: result.replacements || null,
    message: result.message || '',
    verified: Boolean(result.verified),
    severity
  };
  applyVerification();
}

function formatIdentityPayload(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }
  const payload = {
    identity: response.identity,
    challenge: response.challenge,
    signature: response.signature,
    algorithm: response.algorithm,
    proof: response.proof,
    authentication: response.authentication,
    authorized: response.authorized,
    remembered: response.remembered,
    fill: response.fill,
    requestId: response.requestId
  };
  return JSON.stringify(payload, null, 2);
}

function renderIdentity(response) {
  if (!identityElement) {
    return;
  }
  identityElement.textContent = formatIdentityPayload(response);
}

function disableButtons(disabled) {
  if (connectButton) {
    connectButton.disabled = disabled;
  }
  if (forceButton) {
    forceButton.disabled = disabled;
  }
}

function waitForSdid() {
  if (window.SDID?.requestLogin) {
    return Promise.resolve(window.SDID);
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('sdid#initialized', handleInitialized);
      reject(new Error('SDID bridge not detected.'));
    }, 5000);

    function handleInitialized() {
      window.clearTimeout(timeout);
      window.removeEventListener('sdid#initialized', handleInitialized);
      resolve(window.SDID);
    }

    window.addEventListener('sdid#initialized', handleInitialized);
  });
}

function createChallenge() {
  return `demo:${Date.now().toString(16)}:${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
}

async function verifySignatureWithKey(publicKeyJwk, data, signature, subtleCrypto) {
  const subtle =
    subtleCrypto || (globalThis.crypto?.subtle || globalThis.crypto?.webkitSubtle || null);
  if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.verify !== 'function') {
    throw new Error('SubtleCrypto unavailable');
  }

  const publicKey = await subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const binary = atob(signature);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const dataBytes = new TextEncoder().encode(data);
  return subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, publicKey, bytes, dataBytes);
}

async function verifyAuthenticationResponse(response) {
  const identity = response?.identity;
  if (!identity?.publicKeyJwk) {
    return { verified: false, key: 'verification.missing' };
  }

  const signature = response?.proof?.signatureValue || response?.signature;
  const canonicalRequest = typeof response?.authentication?.canonicalRequest === 'string'
    ? response.authentication.canonicalRequest
    : null;
  const payload = response?.authentication?.payload || null;

  let dataToVerify = canonicalRequest;
  if (payload && canonicalRequest) {
    const reconstructed = canonicalizeJson(payload);
    if (reconstructed !== canonicalRequest) {
      return { verified: false, key: 'verification.mismatch' };
    }
  }

  if (!dataToVerify) {
    dataToVerify = response?.challenge || null;
  }

  if (!signature || !dataToVerify) {
    return { verified: false, key: 'verification.missing' };
  }

  const subtle = globalThis.crypto?.subtle || globalThis.crypto?.webkitSubtle || null;
  if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.verify !== 'function') {
    return {
      verified: false,
      key: 'verification.insecureContext',
      severity: 'warning',
      reason: 'unavailable'
    };
  }

  try {
    const verified = await verifySignatureWithKey(
      identity.publicKeyJwk,
      dataToVerify,
      signature,
      subtle
    );
    return { verified, key: verified ? 'verification.success' : 'verification.failure' };
  } catch (error) {
    console.error('Signature verification error', error);
    if (typeof error?.message === 'string' && error.message.includes('SubtleCrypto unavailable')) {
      return {
        verified: false,
        key: 'verification.insecureContext',
        severity: 'warning',
        reason: 'unavailable'
      };
    }
    return { verified: false, key: 'verification.error' };
  }
}

function handleSubmitApproval() {
  const identity = currentIdentityResponse?.identity || null;
  if (!identity?.did) {
    setStatusFromKey('approvals.errors.submissionUnavailable', {}, 'error');
    return;
  }
  if (isAdminIdentity(identity)) {
    setStatusFromKey('approvals.errors.alreadySubmitted', {}, 'info');
    return;
  }
  const certification = getCertificationState(identity);
  if (certification.status !== 'missing') {
    setStatusFromKey('approvals.errors.alreadySubmitted', {}, 'info');
    return;
  }

  const label =
    (identity.label && identity.label.trim()) || identity.did || translate('labels.unknownIdentity');
  const request = {
    id: generateApprovalId(),
    applicantDid: identity.did,
    applicantLabel: identity.label || '',
    applicantRoles: normalizeRoles(identity.roles),
    createdAt: new Date().toISOString(),
    status: 'pending',
    approvedAt: null,
    approverDid: null,
    approverLabel: null,
    approverRoles: []
  };

  updateApprovals([...approvalsState, request]);
  setVerification({ verified: false, key: 'approvals.verification.pending' });
  setStatusFromKey('approvals.actions.submitted', { label }, 'success');
}

async function handleApproveRequest(requestId, triggerButton) {
  if (!requestId) {
    return;
  }

  const request = approvalsState.find((item) => item.id === requestId);
  if (!request || request.status === 'approved') {
    return;
  }

  const identity = currentIdentityResponse?.identity || null;
  if (!identity || !isAdminIdentity(identity)) {
    setStatusFromKey('approvals.errors.adminOnly', {}, 'error');
    return;
  }

  const previousIdentityResponse = currentIdentityResponse;
  const button = triggerButton instanceof HTMLButtonElement ? triggerButton : null;
  if (button) {
    button.disabled = true;
  }
  disableButtons(true);
  setStatusFromKey('approvals.actions.approving');

  try {
    const sdid = await waitForSdid();
    const payload = {
      type: 'sdid-demo-approval',
      requestId: request.id,
      applicantDid: request.applicantDid,
      applicantLabel: request.applicantLabel,
      applicantRoles: normalizeRoles(request.applicantRoles),
      createdAt: request.createdAt
    };
    const challenge = canonicalizeJson(payload);
    const message = translate('approvals.prompts.approveMessage', {
      label: request.applicantLabel || request.applicantDid
    });

    const response = await sdid.requestLogin({
      message,
      challenge,
      forcePrompt: true
    });

    currentIdentityResponse = response;
    renderIdentity(response);
    renderApprovalUI();

    const verification = await verifyAuthenticationResponse(response);
    const verificationUnavailable = !verification.verified && verification.reason === 'unavailable';
    if (!verification.verified && !verificationUnavailable) {
      setVerification(verification);
      setStatusFromKey('approvals.actions.error', {}, 'error');
      currentIdentityResponse = previousIdentityResponse;
      renderIdentity(previousIdentityResponse);
      renderApprovalUI();
      return;
    }
    if (!isAdminIdentity(response.identity)) {
      setVerification({ verified: false, key: 'approvals.verification.adminOnly' });
      setStatusFromKey('approvals.errors.adminOnly', {}, 'error');
      currentIdentityResponse = previousIdentityResponse;
      renderIdentity(previousIdentityResponse);
      renderApprovalUI();
      return;
    }

    const approvedRequest = {
      ...request,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approverDid: response.identity.did,
      approverLabel: response.identity.label || '',
      approverRoles: normalizeRoles(response.identity.roles),
      approvalChallenge: challenge,
      approvalSignature: response.signature || response?.proof?.signatureValue || null
    };

    updateApprovals(
      approvalsState.map((item) => (item.id === request.id ? approvedRequest : item))
    );

    const adjustedVerification = enforceCertification(response, verification);
    setVerification(adjustedVerification);

    const label =
      request.applicantLabel?.trim() || request.applicantDid || translate('labels.unknownIdentity');
    setStatusFromKey('approvals.actions.approved', { label }, 'success');
  } catch (error) {
    console.error('Admin approval failed', error);
    setStatusFromKey('approvals.actions.error', {}, 'error');
    currentIdentityResponse = previousIdentityResponse;
    renderIdentity(previousIdentityResponse);
    renderApprovalUI();
  } finally {
    disableButtons(false);
    if (button) {
      const latest = approvalsState.find((item) => item.id === requestId);
      button.disabled = !latest || latest.status !== 'pending';
    }
  }
}

function initializeLanguage() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (_error) {
    stored = null;
  }
  currentLanguage = sanitizeLanguage(stored || detectLanguage());
  document.documentElement.lang = currentLanguage;
  applyTranslations();
  updateLanguageToggleUI(currentLanguage);
  applyStatus();
  applyVerification();
  renderApprovalUI();
}

function changeLanguage(language) {
  const nextLanguage = sanitizeLanguage(language);
  if (nextLanguage === currentLanguage) {
    updateLanguageToggleUI(nextLanguage);
    return;
  }
  currentLanguage = nextLanguage;
  document.documentElement.lang = currentLanguage;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch (_error) {
    // Ignore storage failures.
  }
  applyTranslations();
  updateLanguageToggleUI(currentLanguage);
  applyStatus();
  applyVerification();
  renderApprovalUI();
}

async function requestLogin(forcePrompt = true) {
  disableButtons(true);
  setVerification(null);
  renderIdentity(null);
  currentIdentityResponse = null;
  lastCertification = { status: 'disconnected', approval: null };
  renderApprovalUI();
  setStatusFromKey('status.connecting');
  try {
    const sdid = await waitForSdid();
    const challenge = createChallenge();
    const response = await sdid.requestLogin({
      message: translate('login.message'),
      challenge,
      forcePrompt
    });
    currentIdentityResponse = response;
    renderIdentity(response);
    const verification = await verifyAuthenticationResponse(response);
    const adjustedVerification = enforceCertification(response, verification);
    setVerification(adjustedVerification);
    const label = (response.identity?.label && response.identity.label.trim())
      || response.identity?.did
      || translate('labels.unknownIdentity');
    const tone = adjustedVerification.verified
      ? 'success'
      : adjustedVerification.severity === 'warning'
      ? 'warning'
      : 'info';
    setStatusFromKey('status.connected', { label }, tone);
    renderApprovalUI();
  } catch (error) {
    console.error('Demo login failed', error);
    currentIdentityResponse = null;
    lastCertification = { status: 'disconnected', approval: null };
    renderApprovalUI();
    const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
    if (rawMessage) {
      const normalized = rawMessage.toLowerCase();
      if (normalized.includes('cancel') || rawMessage.includes('取消') || rawMessage.includes('拒绝')) {
        setStatusFromKey('status.rejected', {}, 'error');
        setVerification({ verified: false, key: 'verification.failure' });
      } else {
        setStatusMessage(rawMessage, 'error');
        setVerification({ verified: false, message: rawMessage });
      }
    } else {
      setStatusFromKey('status.error', {}, 'error');
      setVerification({ verified: false, key: 'verification.error' });
    }
  } finally {
    disableButtons(false);
  }
}

initializeLanguage();

if (languageButtons.length) {
  languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextLanguage = button.dataset.language;
      if (!nextLanguage) {
        return;
      }
      changeLanguage(nextLanguage);
    });
  });
}

if (connectButton) {
  connectButton.addEventListener('click', () => requestLogin());
}

if (forceButton) {
  forceButton.addEventListener('click', () => requestLogin(true));
}

if (submitApprovalButton) {
  submitApprovalButton.addEventListener('click', () => {
    handleSubmitApproval();
  });
}

if (approvalListElement) {
  approvalListElement.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest('button[data-request-id]');
    if (!button) {
      return;
    }
    event.preventDefault();
    const requestId = button.dataset.requestId;
    if (requestId) {
      handleApproveRequest(requestId, button);
    }
  });
}

if (!window.SDID?.requestLogin) {
  setStatusFromKey('status.waiting');
  window.addEventListener(
    'sdid#initialized',
    () => {
      setStatusFromKey('status.ready');
    },
    { once: true }
  );
} else {
  setStatusFromKey('status.ready');
}

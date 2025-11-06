const STORAGE_KEY = 'returnYoungSurvey';
const STORAGE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const PROJECT_START_YEAR = 2023;

const identityOptions = [
  { id: 'entrepreneur', title: '返乡创业者', slogan: '在故土种出梦想', icon: '🌱' },
  { id: 'professional', title: '返乡职场人', slogan: '把职场能量带回家', icon: '🧭' },
  { id: 'lifestyle', title: '返乡生活家', slogan: '让乡村日常充满光', icon: '🍵' },
  { id: 'practitioner', title: '返乡实干派', slogan: '双手雕刻新家园', icon: '🛠️' },
  { id: 'dreamer', title: '返乡梦想家', slogan: '把星辰撒在田野里', icon: '🌌', hidden: true }
];

const moduleDefinitions = [
  {
    id: 'identity',
    title: '身份解码',
    subtitle: '从角色出发，重温返乡初心',
    badge: { title: '身份认证', icon: '🪪' },
    render: renderIdentityModule
  },
  {
    id: 'journey',
    title: '归乡轨迹',
    subtitle: '沿着轨迹地图重回归乡那一刻',
    badge: { title: '归乡行者', icon: '🧭' },
    render: renderJourneyModule
  },
  {
    id: 'reason',
    title: '心动理由',
    subtitle: '拆开初心盲盒，记录每份心动',
    badge: { title: '初心守护者', icon: '💚' },
    render: renderReasonModule
  },
  {
    id: 'future',
    title: '未来抉择',
    subtitle: '站在十字路口，为下一步做足准备',
    badge: { title: '未来探索家', icon: '🚀' },
    render: renderFutureModule
  }
];

const soundPalette = {
  select: { type: 'beep', frequency: 520, duration: 0.12 },
  badge: { type: 'beep', frequency: 660, duration: 0.4 },
  transition: { type: 'whoosh', frequency: 380, duration: 0.25 },
  celebration: { type: 'melody' },
  pause: { type: 'beep', frequency: 280, duration: 0.18 }
};

const state = {
  step: 'start',
  moduleIndex: 0,
  answers: {},
  badges: [],
  hiddenAchievements: new Set(),
  identityClickCount: new Map(),
  continueFromCache: false
};

const app = document.getElementById('app');
const content = document.getElementById('content');
const progressBar = document.getElementById('progressBarInner');
const pauseBtn = document.getElementById('pauseBtn');
const startTemplate = document.getElementById('startTemplate');
const introTemplate = document.getElementById('introTemplate');
const moduleTemplate = document.getElementById('moduleTemplate');
const completionTemplate = document.getElementById('completionTemplate');
const pauseTemplate = document.getElementById('pauseTemplate');
const helpTemplate = document.getElementById('helpTemplate');

let pauseDialog;
let helpDialog;

function init() {
  renderStart();
  setupFloatingHelp();
  pauseBtn.addEventListener('click', handlePauseClick);
}

function renderStart() {
  state.step = 'start';
  state.identityClickCount.clear();
  const fragment = startTemplate.content.cloneNode(true);
  const resumeBtn = fragment.querySelector('[data-action="resume"]');
  const startBtn = fragment.querySelector('[data-action="start"]');
  const identityDialog = fragment.getElementById('identityDialog');
  const resumeDialog = fragment.getElementById('resumeDialog');
  const identityGrid = fragment.getElementById('identityGrid');

  const cached = readCache();
  if (cached) {
    resumeBtn.hidden = false;
  }

  identityOptions.forEach(option => {
    if (option.hidden) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'identity-card';
    card.dataset.id = option.id;
    card.innerHTML = `
      <div class="identity-card__icon">${option.icon}</div>
      <div class="identity-card__title">${option.title}</div>
      <div class="identity-card__slogan">${option.slogan}</div>
    `;
    identityGrid.appendChild(card);
  });

  identityGrid.addEventListener('click', ev => {
    const target = ev.target.closest('.identity-card');
    if (!target) return;
    const id = target.dataset.id;
    target.classList.add('identity-card--active');
    setTimeout(() => target.classList.remove('identity-card--active'), 260);
    recordIdentityClick(id, identityDialog);
    playSound('select');
    identityDialog.close(id);
  });

  startBtn.addEventListener('click', () => {
    playSound('transition');
    identityDialog.showModal();
  });

  identityDialog.addEventListener('close', () => {
    if (identityDialog.returnValue && identityDialog.returnValue !== 'cancel') {
      const selected = identityOptions.find(option => option.id === identityDialog.returnValue || option.title === identityDialog.returnValue);
      state.answers.identity_tag = selected ? selected.title : identityDialog.returnValue;
      state.step = 'intro';
      persistState();
      renderIntro();
    }
  });

  resumeBtn.addEventListener('click', () => {
    resumeDialog.showModal();
  });

  resumeDialog.addEventListener('close', () => {
    const { returnValue } = resumeDialog;
    if (returnValue === 'resume') {
      restoreCache();
      if (state.step === 'complete') {
        renderCompletion();
      } else if (state.step === 'modules') {
        renderModule(state.moduleIndex);
      } else {
        renderIntro();
      }
    } else if (cached) {
      clearCache();
      state.answers = {};
      state.badges = [];
      state.moduleIndex = 0;
      state.step = 'start';
      renderStart();
    }
  });

  mountContent(fragment);
}

function renderIntro() {
  state.step = 'intro';
  const fragment = introTemplate.content.cloneNode(true);
  const checkbox = fragment.getElementById('introReady');
  const goBtn = fragment.querySelector('[data-action="go"]');

  checkbox.addEventListener('change', () => {
    goBtn.disabled = !checkbox.checked;
  });

  goBtn.addEventListener('click', () => {
    playSound('transition');
    state.step = 'modules';
    state.moduleIndex = 0;
    persistState();
    renderModule(0);
  });

  mountContent(fragment);
}

function renderModule(index) {
  const moduleDef = moduleDefinitions[index];
  if (!moduleDef) {
    renderCompletion();
    return;
  }

  state.moduleIndex = index;
  const fragment = moduleTemplate.content.cloneNode(true);
  const screen = fragment.querySelector('[data-module]');
  const title = fragment.querySelector('.module-screen__title');
  const subtitle = fragment.querySelector('.module-screen__subtitle');
  const body = fragment.querySelector('[data-module-body]');
  const nextBtn = fragment.querySelector('[data-action="next"]');
  const prevBtn = fragment.querySelector('[data-action="prev"]');

  title.textContent = `「${moduleDef.title}」探索`; 
  subtitle.textContent = moduleDef.subtitle;

  moduleDef.render(body, nextBtn);

  prevBtn.disabled = index === 0;
  prevBtn.addEventListener('click', () => {
    playSound('transition');
    renderModule(index - 1);
  });

  nextBtn.addEventListener('click', () => {
    playSound('transition');
    unlockBadge(moduleDef.badge);
    persistState();
    renderModule(index + 1);
  });

  mountContent(fragment);
  updateProgress();
}

function renderCompletion() {
  state.step = 'complete';
  persistState();
  const fragment = completionTemplate.content.cloneNode(true);
  const badgeList = fragment.getElementById('badgeList');
  const summaryGrid = fragment.getElementById('summaryGrid');
  const hiddenBlock = fragment.getElementById('hiddenAchievements');
  const hiddenList = hiddenBlock.querySelector('ul');
  const saveBtn = fragment.querySelector('[data-action="save"]');
  const restartBtn = fragment.querySelector('[data-action="restart"]');

  ensureAllBadges();
  state.badges.forEach(badge => {
    const badgeEl = document.createElement('div');
    badgeEl.className = 'badge';
    badgeEl.innerHTML = `<span>${badge.icon}</span><small>${badge.title}</small>`;
    badgeList.appendChild(badgeEl);
  });

  const summaryMap = {
    identity_tag: '身份标签',
    gender: '性别',
    age: '年龄',
    education: '最高学历',
    return_time: '返乡时间',
    return_type: '返乡类型',
    return_reason: '返乡主要原因',
    leave_reason: '可能再次离开的原因'
  };

  Object.entries(summaryMap).forEach(([key, label]) => {
    if (!state.answers[key]) return;
    const item = document.createElement('div');
    item.className = 'summary-item';
    item.innerHTML = `<h4>${label}</h4><p>${formatAnswer(state.answers[key])}</p>`;
    summaryGrid.appendChild(item);
  });

  if (state.hiddenAchievements.size) {
    hiddenBlock.hidden = false;
    state.hiddenAchievements.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      hiddenList.appendChild(li);
    });
  }

  saveBtn.addEventListener('click', () => {
    playSound('celebration');
    saveSummaryCard();
  });

  restartBtn.addEventListener('click', () => {
    playSound('transition');
    clearCache();
    state.answers = {};
    state.badges = [];
    state.hiddenAchievements.clear();
    state.moduleIndex = 0;
    renderStart();
  });

  mountContent(fragment);
  updateProgress(true);
}

function ensureAllBadges() {
  moduleDefinitions.forEach(mod => {
    if (!state.badges.find(b => b.title === mod.badge.title)) {
      state.badges.push(mod.badge);
    }
  });
}

function renderIdentityModule(container, nextBtn) {
  container.innerHTML = '';
  const savedGender = state.answers.gender;
  const savedAge = state.answers.age;
  const savedEducation = state.answers.education;

  const genderSection = document.createElement('section');
  genderSection.innerHTML = `<h3>性格盲盒 · 选择你的角色氛围</h3>`;
  const genderCards = document.createElement('div');
  genderCards.className = 'gender-cards';

  const genders = [
    { id: '男', title: '男生', tag: '阳光创业者', icon: '🧑‍🌾' },
    { id: '女', title: '女生', tag: '温柔实干家', icon: '👩‍🌾' },
    { id: '不想透露', title: '不想透露', tag: '神秘探索家', icon: '🦸' }
  ];

  genders.forEach(option => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gender-card';
    card.dataset.id = option.id;
    card.innerHTML = `
      <div class="gender-card__avatar">${option.icon}</div>
      <div class="gender-card__title">${option.title}</div>
      <div class="gender-card__tag">${option.tag}</div>
    `;
    if (savedGender === option.id) {
      card.classList.add('gender-card--active');
    }
    card.addEventListener('click', () => {
      playSound('select');
      genderCards.querySelectorAll('.gender-card').forEach(btn => btn.classList.remove('gender-card--active'));
      card.classList.add('gender-card--active');
      card.classList.add('flip');
      setTimeout(() => card.classList.remove('flip'), 400);
      applyAnswer('gender', option.id);
      maybeEnableNext(nextBtn);
    });
    genderCards.appendChild(card);
  });

  genderSection.appendChild(genderCards);
  container.appendChild(genderSection);

  const ageSection = document.createElement('section');
  const ageCard = document.createElement('div');
  ageCard.className = 'age-input';
  ageCard.innerHTML = `
    <label>时光刻度 · 滑动点亮你的年龄</label>
    <input type="range" class="age-slider" min="18" max="45" step="1" value="${savedAge ?? 25}">
    <div class="age-value" aria-live="polite">${savedAge ?? 25}</div>
    <div class="age-hint">${getAgeHint(savedAge ?? 25)}</div>
    <label>或直接输入：<input type="number" min="18" max="45" value="${savedAge ?? 25}" class="select"></label>
    <button class="btn btn--ghost" type="button">继续探索</button>
  `;
  const range = ageCard.querySelector('input[type="range"]');
  const number = ageCard.querySelector('input[type="number"]');
  const valueLabel = ageCard.querySelector('.age-value');
  const hint = ageCard.querySelector('.age-hint');
  const continueBtn = ageCard.querySelector('button');

  const syncAge = val => {
    const age = clamp(Number(val), 18, 45);
    range.value = String(age);
    number.value = String(age);
    valueLabel.textContent = age;
    hint.textContent = getAgeHint(age);
    applyAnswer('age', age);
  };

  range.addEventListener('input', ev => {
    playSound('select');
    syncAge(ev.target.value);
  });

  number.addEventListener('change', ev => {
    playSound('select');
    syncAge(ev.target.value);
  });

  continueBtn.addEventListener('click', () => {
    playSound('transition');
    maybeEnableNext(nextBtn);
  });

  ageSection.appendChild(ageCard);
  container.appendChild(ageSection);

  const eduSection = document.createElement('section');
  const eduCard = document.createElement('div');
  eduCard.className = 'education-select';
  eduCard.innerHTML = `
    <label for="educationSelect">知识树 · 最高学历</label>
    <select id="educationSelect" class="select">
      <option value="" disabled ${!savedEducation ? 'selected' : ''}>请选择</option>
      <option value="初中及以下">初中及以下</option>
      <option value="高中/中专/技校">高中/中专/技校</option>
      <option value="大专">大专</option>
      <option value="本科">本科</option>
      <option value="硕士研究生及以上">硕士研究生及以上</option>
    </select>
    <div class="knowledge-tree">
      <div class="knowledge-tree__branch" style="height: ${getBranchHeight(savedEducation)}"></div>
      <div class="knowledge-tree__leaves" style="opacity: ${savedEducation ? 1 : 0}">
        <img alt="知识树" src="data:image/svg+xml,%3Csvg width='160' height='140' viewBox='0 0 160 140' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M80 130C84 110 84 92 80 76C94 80 108 70 112 56C134 66 144 44 134 30C142 22 142 8 130 4C118 0 108 8 106 18C94 6 72 8 62 22C44 14 26 26 28 44C10 50 10 74 28 82C20 96 32 114 48 112C46 124 60 134 72 128L80 130Z' fill='%233DAE2B' fill-opacity='0.8'/%3E%3C/svg%3E'" />
      </div>
    </div>
    <small class="age-hint">解锁成就：身份认证徽章</small>
  `;

  const select = eduCard.querySelector('select');
  const branch = eduCard.querySelector('.knowledge-tree__branch');
  const leaves = eduCard.querySelector('.knowledge-tree__leaves');

  if (savedEducation) {
    select.value = savedEducation;
  }

  select.addEventListener('change', () => {
    playSound('select');
    const value = select.value;
    branch.style.height = getBranchHeight(value);
    leaves.style.opacity = 1;
    applyAnswer('education', value);
    maybeEnableNext(nextBtn);
    checkEducationBuff();
  });

  eduSection.appendChild(eduCard);
  container.appendChild(eduSection);

  maybeEnableNext(nextBtn);
}

function renderJourneyModule(container, nextBtn) {
  const savedTime = state.answers.return_time;
  const savedType = state.answers.return_type;

  const calendarSection = document.createElement('section');
  calendarSection.className = 'calendar-card';
  calendarSection.innerHTML = `
    <h3>时光日历 · 记录归乡时间</h3>
    <input type="month" class="calendar-input" value="${savedTime ?? ''}" min="2000-01" max="2030-12">
    <p class="age-hint" data-feedback>${savedTime ? formatReturnTime(savedTime) : '选择年份和月份，解锁季节风景'}</p>
  `;

  const monthInput = calendarSection.querySelector('input');
  const feedback = calendarSection.querySelector('[data-feedback]');

  monthInput.addEventListener('change', () => {
    playSound('select');
    const value = monthInput.value;
    applyAnswer('return_time', value);
    feedback.textContent = formatReturnTime(value);
    maybeEnableNext(nextBtn);
    check同期Badge(value);
  });

  const mapSection = document.createElement('section');
  mapSection.className = 'map-card';
  mapSection.innerHTML = `<h3>轨迹地图 · 返乡旅程类型</h3>`;
  const mapOptions = document.createElement('div');
  mapOptions.className = 'map-options';

  const options = [
    {
      id: '首次返乡',
      title: '初心之旅',
      caption: '第一次踏上归乡列车',
      gradient: 'linear-gradient(90deg, rgba(61,174,43,0.4), rgba(74,144,226,0.2))'
    },
    {
      id: '多次返乡',
      title: '重逢之旅',
      caption: '反复往返于城市与乡村之间',
      gradient: 'linear-gradient(90deg, rgba(74,144,226,0.4), rgba(255,149,0,0.2))'
    }
  ];

  options.forEach(option => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-option';
    card.dataset.id = option.id;
    card.innerHTML = `
      <div class="map-option__route" style="background:${option.gradient}"></div>
      <div class="map-option__title">${option.title}</div>
      <div class="map-option__caption">${option.caption}</div>
    `;
    if (savedType === option.id) {
      card.classList.add('map-option--active');
    }
    card.addEventListener('click', () => {
      playSound('select');
      mapOptions.querySelectorAll('.map-option').forEach(btn => btn.classList.remove('map-option--active'));
      card.classList.add('map-option--active');
      applyAnswer('return_type', option.id);
      maybeEnableNext(nextBtn);
    });
    mapOptions.appendChild(card);
  });

  mapSection.appendChild(mapOptions);
  container.appendChild(calendarSection);
  container.appendChild(mapSection);

  maybeEnableNext(nextBtn);
}

function renderReasonModule(container, nextBtn) {
  const savedReasons = new Set(state.answers.return_reason || []);
  const card = document.createElement('section');
  card.className = 'reasons-card';
  card.innerHTML = `
    <h3>初心盲盒 · 你返乡的主要原因</h3>
    <p class="age-hint">最多选择三个盲盒，拆开后会贴到初心墙上</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'reason-grid';
  const limit = 3;

  const reasons = [
    { id: '家庭陪伴', icon: '🏡', label: '家庭陪伴' },
    { id: '创业机会', icon: '🌱', label: '创业/发展事业' },
    { id: '政策支持', icon: '🚩', label: '政策支持' },
    { id: '生活成本', icon: '💰', label: '降低生活成本' },
    { id: '就业机会', icon: '💼', label: '本地就业机会' },
    { id: '生活品质', icon: '🌤️', label: '向往生活品质' },
    { id: '社会服务', icon: '🤝', label: '社会服务/回馈乡里' },
    { id: '其他', icon: '✨', label: '其他原因' }
  ];

  const renderSelectionState = () => {
    grid.querySelectorAll('.reason-card').forEach(cardEl => {
      const isActive = savedReasons.has(cardEl.dataset.id);
      cardEl.classList.toggle('reason-card--active', isActive);
    });
    const tip = card.querySelector('.reason-limit');
    if (tip) tip.textContent = `${savedReasons.size}/${limit}`;
    maybeEnableNext(nextBtn);
  };

  reasons.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reason-card';
    btn.dataset.id = option.id;
    btn.innerHTML = `
      <div class="reason-card__icon">${option.icon}</div>
      <div class="reason-card__title">${option.label}</div>
    `;
    btn.addEventListener('click', () => {
      playSound('select');
      if (savedReasons.has(option.id)) {
        savedReasons.delete(option.id);
      } else if (savedReasons.size < limit) {
        savedReasons.add(option.id);
        btn.classList.add('flip');
        setTimeout(() => btn.classList.remove('flip'), 360);
      }
      applyAnswer('return_reason', Array.from(savedReasons));
      renderSelectionState();
      checkEducationBuff();
    });
    grid.appendChild(btn);
  });

  card.appendChild(grid);
  const limitTip = document.createElement('p');
  limitTip.className = 'reason-limit';
  limitTip.textContent = `${savedReasons.size}/${limit}`;
  card.appendChild(limitTip);

  container.appendChild(card);
  renderSelectionState();
}

function renderFutureModule(container, nextBtn) {
  const savedReasons = new Set(state.answers.leave_reason || []);
  const card = document.createElement('section');
  card.className = 'future-card';
  card.innerHTML = `
    <h3>未来十字路口 · 你可能再次离开的原因</h3>
    <p class="age-hint">最多选择三个指示牌</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'future-grid';
  const limit = 3;

  const reasons = [
    { id: '就业机会', icon: '📈', label: '外地就业机会更好' },
    { id: '收入水平', icon: '💹', label: '收入成长空间有限' },
    { id: '教育资源', icon: '📚', label: '家庭教育资源考虑' },
    { id: '社交圈', icon: '🤗', label: '社交圈/生活圈变化' },
    { id: '个人发展', icon: '⭐', label: '个人发展愿景调整' },
    { id: '城市体验', icon: '🏙️', label: '想体验城市节奏' },
    { id: '医疗服务', icon: '🏥', label: '医疗健康服务因素' },
    { id: '其他', icon: '✨', label: '其他考量' }
  ];

  const renderState = () => {
    grid.querySelectorAll('.future-card__option').forEach(btn => {
      btn.classList.toggle('future-card__option--active', savedReasons.has(btn.dataset.id));
    });
    const tip = card.querySelector('.reason-limit');
    if (tip) tip.textContent = `${savedReasons.size}/${limit}`;
    maybeEnableNext(nextBtn);
  };

  reasons.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'future-card__option';
    btn.dataset.id = option.id;
    btn.innerHTML = `
      <div class="future-card__icon">${option.icon}</div>
      <div class="future-card__title">${option.label}</div>
    `;
    btn.addEventListener('click', () => {
      playSound('select');
      if (savedReasons.has(option.id)) {
        savedReasons.delete(option.id);
      } else if (savedReasons.size < limit) {
        savedReasons.add(option.id);
        btn.classList.add('flip');
        setTimeout(() => btn.classList.remove('flip'), 360);
      }
      applyAnswer('leave_reason', Array.from(savedReasons));
      renderState();
    });
    grid.appendChild(btn);
  });

  card.appendChild(grid);
  const limitTip = document.createElement('p');
  limitTip.className = 'reason-limit';
  limitTip.textContent = `${savedReasons.size}/${limit}`;
  card.appendChild(limitTip);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn--primary';
  submitBtn.textContent = '提交探索';
  submitBtn.addEventListener('click', () => {
    playSound('transition');
    nextBtn.click();
  });

  container.appendChild(card);
  container.appendChild(submitBtn);
  renderState();
}

function setupFloatingHelp() {
  const helpFragment = helpTemplate.content.cloneNode(true);
  app.appendChild(helpFragment);
  helpDialog = app.querySelector('#helpDialog');
  document.getElementById('helpButton').addEventListener('click', () => {
    playSound('select');
    helpDialog.showModal();
  });
}

function handlePauseClick() {
  if (!pauseDialog) {
    const pauseFragment = pauseTemplate.content.cloneNode(true);
    app.appendChild(pauseFragment);
    pauseDialog = app.querySelector('#pauseDialog');
  }
  playSound('pause');
  pauseDialog.showModal();
  pauseDialog.addEventListener('close', () => {
    if (pauseDialog.returnValue === 'confirm') {
      persistState();
      showToast('旅程已暂停，欢迎随时归来');
    }
  }, { once: true });
}

function updateProgress(forceComplete = false) {
  if (forceComplete) {
    progressBar.style.width = '100%';
    return;
  }
  const percent = ((state.moduleIndex) / moduleDefinitions.length) * 100;
  progressBar.style.width = `${Math.max(5, percent)}%`;
}

function maybeEnableNext(nextBtn) {
  const requiredFields = getRequiredFieldsForModule();
  const allFilled = requiredFields.every(key => hasAnswer(key));
  nextBtn.disabled = !allFilled;
}

function getRequiredFieldsForModule() {
  const moduleId = moduleDefinitions[state.moduleIndex]?.id;
  switch (moduleId) {
    case 'identity':
      return ['gender', 'age', 'education'];
    case 'journey':
      return ['return_time', 'return_type'];
    case 'reason':
      return ['return_reason'];
    case 'future':
      return ['leave_reason'];
    default:
      return [];
  }
}

function hasAnswer(key) {
  const answer = state.answers[key];
  if (Array.isArray(answer)) {
    return answer.length > 0;
  }
  return answer !== undefined && answer !== '' && answer !== null;
}

function applyAnswer(key, value) {
  if (Array.isArray(value)) {
    state.answers[key] = value;
  } else {
    state.answers[key] = value;
  }
  persistState();
}

function recordIdentityClick(id, dialog) {
  const count = state.identityClickCount.get(id) || 0;
  const nextCount = count + 1;
  state.identityClickCount.set(id, nextCount);
  if (nextCount >= 3) {
    const before = state.hiddenAchievements.size;
    dialog.close('返乡梦想家');
    state.hiddenAchievements.add('解锁隐藏身份「返乡梦想家」');
    if (state.hiddenAchievements.size !== before) {
      persistState();
    }
    playSound('badge');
  }
}

function getIdentityById(id) {
  return identityOptions.find(item => item.id === id);
}

function checkEducationBuff() {
  const isHighEdu = state.answers.education === '硕士研究生及以上';
  const hasEntrepreneurReason = (state.answers.return_reason || []).some(item => item.includes('创业'));
  if (isHighEdu && hasEntrepreneurReason) {
    const before = state.hiddenAchievements.size;
    state.hiddenAchievements.add('获得「高端人才创业buff」');
    if (state.hiddenAchievements.size !== before) {
      persistState();
    }
  }
}

function check同期Badge(value) {
  if (!value) return;
  const [year] = value.split('-');
  if (Number(year) === PROJECT_START_YEAR) {
    const before = state.hiddenAchievements.size;
    state.hiddenAchievements.add('获得限定徽章「同期同行者」');
    if (state.hiddenAchievements.size !== before) {
      persistState();
    }
  }
}

function unlockBadge(badge) {
  if (!state.badges.find(item => item.title === badge.title)) {
    state.badges.push(badge);
    showToast(`解锁徽章：${badge.title}`);
    playSound('badge');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'badge-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('badge-toast--show');
  });
  setTimeout(() => {
    toast.classList.remove('badge-toast--show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 1800);
}

function saveSummaryCard() {
  const card = document.getElementById('summaryCard');
  if (!card) return;
  html2canvas(card, { backgroundColor: '#F1F8F2' }).then(canvas => {
    const link = document.createElement('a');
    link.download = '返乡发展图鉴.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('图鉴已保存到相册');
  });
}

function mountContent(fragment) {
  content.innerHTML = '';
  content.appendChild(fragment);
}

function persistState() {
  const payload = {
    timestamp: Date.now(),
    state: {
      step: state.step,
      moduleIndex: state.moduleIndex,
      answers: state.answers,
      badges: state.badges,
      hiddenAchievements: Array.from(state.hiddenAchievements)
    }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function readCache() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (Date.now() - payload.timestamp > STORAGE_TTL) {
      clearCache();
      return null;
    }
    return payload.state;
  } catch (err) {
    console.error('缓存读取失败', err);
    clearCache();
    return null;
  }
}

function restoreCache() {
  const cached = readCache();
  if (!cached) return;
  state.step = cached.step || 'intro';
  state.moduleIndex = cached.moduleIndex || 0;
  state.answers = cached.answers || {};
  state.badges = cached.badges || [];
  state.hiddenAchievements = new Set(cached.hiddenAchievements || []);
  updateProgress();
}

function clearCache() {
  localStorage.removeItem(STORAGE_KEY);
}

function formatAnswer(value) {
  if (Array.isArray(value)) {
    return value.join('、');
  }
  if (value === '男' || value === '女' || value === '不想透露') {
    return value;
  }
  if (typeof value === 'number') {
    return `${value} 岁`;
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}$/.test(value)) {
      return formatReturnTime(value);
    }
    return value;
  }
  return '';
}

function formatReturnTime(value) {
  if (!value) return '';
  const [year, month] = value.split('-');
  const season = getSeason(month);
  return `${year}年${month}月，正是${season}好风光～`;
}

function getSeason(monthStr) {
  const month = Number(monthStr);
  if ([12, 1, 2].includes(month)) return '冬季';
  if ([3, 4, 5].includes(month)) return '春季';
  if ([6, 7, 8].includes(month)) return '夏季';
  return '秋季';
}

function getAgeHint(age) {
  if (age < 22) return `${age}岁：青春加速，返乡探索刚刚启航～`;
  if (age < 30) return `${age}岁：返乡追梦的黄金年纪～`;
  if (age < 36) return `${age}岁：经验与热情的完美平衡～`;
  return `${age}岁：沉淀后的厚积薄发时刻～`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBranchHeight(value) {
  switch (value) {
    case '初中及以下':
      return '50%';
    case '高中/中专/技校':
      return '60%';
    case '大专':
      return '70%';
    case '本科':
      return '85%';
    case '硕士研究生及以上':
      return '100%';
    default:
      return '40%';
  }
}

function setupAudioContext() {
  if (setupAudioContext.ctx) return setupAudioContext.ctx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  setupAudioContext.ctx = new AudioContext();
  document.addEventListener('click', () => {
    if (setupAudioContext.ctx.state === 'suspended') {
      setupAudioContext.ctx.resume();
    }
  }, { once: true });
  return setupAudioContext.ctx;
}

function playSound(key) {
  const spec = soundPalette[key];
  if (!spec) return;
  const ctx = setupAudioContext();
  if (!ctx) return;

  if (spec.type === 'melody') {
    const notes = [
      { freq: 523, duration: 0.2 },
      { freq: 659, duration: 0.2 },
      { freq: 784, duration: 0.24 },
      { freq: 659, duration: 0.16 },
      { freq: 880, duration: 0.28 }
    ];
    let time = ctx.currentTime;
    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note.freq;
      gain.gain.value = 0.0001;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.exponentialRampToValueAtTime(0.4, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + note.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + note.duration + 0.05);
      time += note.duration * 0.9;
    });
    return;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type === 'whoosh' ? 'sine' : 'square';
  osc.frequency.value = spec.frequency;
  gain.gain.value = 0.001;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(spec.type === 'whoosh' ? 0.35 : 0.25, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + spec.duration + 0.05);
}

document.addEventListener('DOMContentLoaded', init);

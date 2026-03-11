(() => {
  const COOKIE_KEY = 'focus_app_cookie';
  const FALLBACK_KEY = 'focus_app_fallback';
  const LEGACY_KEYS = ['premium-focus-state-v3', 'premium-focus-state-v2', 'premium-focus-state-v1'];
  const TICK_INTERVAL_MS = 1000;
  const FLIP_DURATION_MS = 600;
  const FLIP_REVEAL_DELAY_MS = 280;
  const DEFAULTS = {
    mode: 'countdown',
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    dailyGoalEnabled: true,
    dailyGoalSeconds: 4 * 60 * 60,
    showTodayFocus: true,
    showSeconds: false,
    language: 'tr',
    theme: 'obsidian',
    timerStyle: 'airy',
    displayLayout: 'flip',
    background: 'midnight'
  };

  const store = loadStore();
  const state = {
    sidebarOpen: false,
    statsOpen: false,
    modeJustChanged: false,
    pulseTimer: null,
    lastDayKey: '',
    clockNow: Date.now(),
    display: {
      value: '',
      pairCount: 0
    },
    countdown: {
      status: 'idle',
      phase: 'work',
      remainingMs: store.prefs.workDuration * 1000,
      targetEnd: null,
      sessionLengthMs: store.prefs.workDuration * 1000
    },
    stopwatch: {
      status: 'idle',
      elapsedBeforeRun: 0,
      displayMs: 0,
      startedAt: null
    }
  };

  const el = {
    body: document.body,
    sidebar: document.getElementById('sidebar'),
    controls: document.querySelector('.controls'),
    menuButton: document.getElementById('menuButton'),
    overlay: document.getElementById('overlay'),
    mainShell: document.getElementById('mainShell'),
    flipDisplay: document.getElementById('flipDisplay'),
    classicDisplay: document.getElementById('classicDisplay'),
    footnote: document.getElementById('footnote'),
    startButton: document.getElementById('startButton'),
    stopButton: document.getElementById('stopButton'),
    cancelButton: document.getElementById('cancelButton'),
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
    layoutButtons: Array.from(document.querySelectorAll('[data-layout]')),
    themeButtons: Array.from(document.querySelectorAll('[data-theme]')),
    styleButtons: Array.from(document.querySelectorAll('[data-style]')),
    backgroundButtons: Array.from(document.querySelectorAll('[data-background]')),
    workInput: document.getElementById('workInput'),
    breakInput: document.getElementById('breakInput'),
    phaseValue: document.getElementById('phaseValue'),
    goalToggle: document.getElementById('goalToggle'),
    goalInput: document.getElementById('goalInput'),
    goalCopy: document.getElementById('goalCopy'),
    todayFocus: document.getElementById('todayFocus'),
    todaySessions: document.getElementById('todaySessions'),
    allTimeFocus: document.getElementById('allTimeFocus'),
    showFocusToggle: document.getElementById('showFocusToggle'),
    showSecondsToggle: document.getElementById('showSecondsToggle'),
    langButtons: Array.from(document.querySelectorAll('[data-language]')),
    flipGroups: Array.from(document.querySelectorAll('[data-group]')),
    flipDividers: Array.from(document.querySelectorAll('[data-divider]')),
    flipSlots: Array.from(document.querySelectorAll('[data-slot]')),
    openStatsButton: document.getElementById('openStatsButton'),
    statsPage: document.getElementById('statsPage'),
    statsBackdrop: document.getElementById('statsBackdrop'),
    closeStatsButton: document.getElementById('closeStatsButton'),
    metricTodayFocus: document.getElementById('metricTodayFocus'),
    metricTodaySessions: document.getElementById('metricTodaySessions'),
    metricWeekFocus: document.getElementById('metricWeekFocus'),
    metricWeekSessions: document.getElementById('metricWeekSessions'),
    metricAverageSession: document.getElementById('metricAverageSession'),
    metricStreak: document.getElementById('metricStreak'),
    metricAllTimeFocus: document.getElementById('metricAllTimeFocus'),
    metricAllTimeSessions: document.getElementById('metricAllTimeSessions'),
    weeklyFocusSummary: document.getElementById('weeklyFocusSummary'),
    weeklyBars: document.getElementById('weeklyBars'),
    trendFocusSummary: document.getElementById('trendFocusSummary'),
    trendArea: document.getElementById('trendArea'),
    trendLine: document.getElementById('trendLine'),
    trendDots: document.getElementById('trendDots'),
    trendLabels: document.getElementById('trendLabels'),
    modeSplitSummary: document.getElementById('modeSplitSummary'),
    modeRing: document.getElementById('modeRing'),
    modeRingValue: document.getElementById('modeRingValue'),
    countdownSplitValue: document.getElementById('countdownSplitValue'),
    stopwatchSplitValue: document.getElementById('stopwatchSplitValue'),
    recentSessionsSummary: document.getElementById('recentSessionsSummary'),
    recentSessionsList: document.getElementById('recentSessionsList')
  };

  init();

  function init() {
    ensureToday();
    prepareFlipSlots();
    bindEvents();
    applyBodyClasses();
    primeCountdown('work', false);
    saveStore();
    renderAll();
    window.setInterval(tick, TICK_INTERVAL_MS);
  }

  function prepareFlipSlots() {
    el.flipSlots.forEach((slot) => {
      ensureFlipRunner(slot.querySelector('.flip-flap--top'));
      ensureFlipRunner(slot.querySelector('.flip-flap--bottom'));
    });
  }

  function ensureFlipRunner(container) {
    if (!container || container.querySelector('.flip-runner__current')) {
      return;
    }

    const value = container.textContent.trim() || '0';
    container.innerHTML = [
      `<span class="flip-runner__current">${value}</span>`,
      `<span class="flip-runner__next">${value}</span>`
    ].join('');
  }
  function bindEvents() {
    el.menuButton.addEventListener('click', toggleSidebar);
    el.overlay.addEventListener('click', closeSidebar);
    el.startButton.addEventListener('click', handleStart);
    el.stopButton.addEventListener('click', handleStop);
    el.cancelButton.addEventListener('click', handleCancel);
    el.openStatsButton.addEventListener('click', openStatsPage);
    el.closeStatsButton.addEventListener('click', closeStatsPage);
    el.statsBackdrop.addEventListener('click', closeStatsPage);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (state.statsOpen) {
          closeStatsPage();
        } else if (state.sidebarOpen) {
          closeSidebar();
        }
      }
    });

    el.modeButtons.forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.mode));
    });

    el.layoutButtons.forEach((button) => {
      button.addEventListener('click', () => {
        store.prefs.displayLayout = button.dataset.layout;
        state.display.value = '';
        state.display.pairCount = 0;
        saveStore();
        renderAll();
      });
    });

    el.themeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        store.prefs.theme = button.dataset.theme;
        applyBodyClasses();
        saveStore();
        renderAll();
      });
    });

    el.styleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        store.prefs.timerStyle = button.dataset.style;
        applyBodyClasses();
        saveStore();
        renderAll();
      });
    });

    el.backgroundButtons.forEach((button) => {
      button.addEventListener('click', () => {
        store.prefs.background = button.dataset.background;
        applyBodyClasses();
        saveStore();
        renderAll();
      });
    });

    el.workInput.addEventListener('change', () => {
      store.prefs.workDuration = clampNumber(el.workInput.value, 1, 180, DEFAULTS.workDuration / 60) * 60;
      if (state.countdown.status === 'idle' && state.countdown.phase === 'work') {
        primeCountdown('work', false);
      }
      saveStore();
      renderAll();
    });

    el.breakInput.addEventListener('change', () => {
      store.prefs.breakDuration = clampNumber(el.breakInput.value, 0, 90, DEFAULTS.breakDuration / 60) * 60;
      if (state.countdown.status === 'idle' && state.countdown.phase === 'break') {
        primeCountdown('break', false);
      }
      saveStore();
      renderAll();
    });

    el.goalToggle.addEventListener('change', () => {
      store.prefs.dailyGoalEnabled = el.goalToggle.checked;
      saveStore();
      renderAll();
    });

    el.goalInput.addEventListener('change', () => {
      store.prefs.dailyGoalSeconds = clampNumber(el.goalInput.value, 15, 720, DEFAULTS.dailyGoalSeconds / 60) * 60;
      saveStore();
      renderAll();
    });

    el.showSecondsToggle.addEventListener('change', () => {
      store.prefs.showSeconds = el.showSecondsToggle.checked;
      state.display.value = '';
      state.display.pairCount = 0;
      saveStore();
      renderAll();
    });

    el.showFocusToggle.addEventListener('change', () => {
      store.prefs.showTodayFocus = el.showFocusToggle.checked;
      saveStore();
      renderAll();
    });
    el.langButtons.forEach((button) => {
      button.addEventListener('click', () => {
        store.prefs.language = button.dataset.language === 'en' ? 'en' : 'tr';
        saveStore();
        renderAll();
      });
    });
  }

  function tick() {
    const now = Date.now();
    state.clockNow = now;

    if (state.lastDayKey !== todayKey()) {
      ensureToday();
      safeCall(renderStats);
      safeCall(renderFootnote);
      if (state.statsOpen) {
        safeCall(renderStatsPage);
      }
    }

    if (state.countdown.status === 'running') {
      state.countdown.remainingMs = Math.max(0, state.countdown.targetEnd - now);
      if (state.countdown.remainingMs <= 0) {
        finishCountdown();
        return;
      }
    }

    if (state.stopwatch.status === 'running') {
      state.stopwatch.displayMs = state.stopwatch.elapsedBeforeRun + (now - state.stopwatch.startedAt);
    }

    safeCall(renderDisplay);
    safeCall(renderControls);
    safeCall(renderStats);
    safeCall(renderFootnote);
  }

  function loadStore() {
    const candidates = [
      readCookieJSON(COOKIE_KEY),
      readLocalJSON(FALLBACK_KEY),
      ...LEGACY_KEYS.map(readLocalJSON)
    ];

    const parsed = candidates.find((entry) => Boolean(entry)) || null;
    return normalizeStore(parsed);
  }

  function normalizeMode(value) {
    return ['countdown', 'stopwatch', 'clock'].includes(value) ? value : DEFAULTS.mode;
  }

  function normalizeTheme(value) {
    return ['obsidian', 'graphite', 'cinder', 'rose', 'blush', 'pearl'].includes(value) ? value : DEFAULTS.theme;
  }

  function normalizeStyle(value) {
    return ['airy', 'balanced', 'defined'].includes(value) ? value : DEFAULTS.timerStyle;
  }

  function normalizeLayout(value) {
    return ['flip', 'classic'].includes(value) ? value : DEFAULTS.displayLayout;
  }

  function normalizeBackground(value) {
    return ['midnight', 'forest', 'ocean', 'dawn', 'alpine', 'sand', 'rosewater', 'petal', 'berry'].includes(value) ? value : DEFAULTS.background;
  }

  function normalizeBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (lowered === 'true' || lowered === '1') return true;
      if (lowered === 'false' || lowered === '0') return false;
    }
    return Boolean(value);
  }
  function normalizeStore(parsed) {
    if (!parsed) {
      return createDefaultStore();
    }

    if (parsed.p || parsed.s) {
      return {
        prefs: {
          ...DEFAULTS,
          mode: normalizeMode(parsed.p?.m),
          workDuration: clampNumber(Number(parsed.p?.w), 60, 180 * 60, DEFAULTS.workDuration),
          breakDuration: clampNumber(Number(parsed.p?.b), 0, 90 * 60, DEFAULTS.breakDuration),
          dailyGoalEnabled: normalizeBoolean(parsed.p?.ge, DEFAULTS.dailyGoalEnabled),
          dailyGoalSeconds: clampNumber(Number(parsed.p?.g), 15 * 60, 720 * 60, DEFAULTS.dailyGoalSeconds),
          showTodayFocus: normalizeBoolean(parsed.p?.sf, DEFAULTS.showTodayFocus),
          showSeconds: normalizeBoolean(parsed.p?.ss, DEFAULTS.showSeconds),
          language: parsed.p?.lg === 'en' ? 'en' : 'tr',
          theme: normalizeTheme(parsed.p?.t),
          timerStyle: normalizeStyle(parsed.p?.ty),
          displayLayout: normalizeLayout(parsed.p?.l),
          background: normalizeBackground(parsed.p?.bg)
        },
        stats: {
          allTimeFocusSeconds: Number(parsed.s?.a) || 0,
          allTimeSessions: Number(parsed.s?.c) || 0,
          daily: normalizeDailyEntries(parsed.s?.d),
          recentSessions: normalizeRecentSessions(parsed.s?.r)
        }
      };
    }

    const prefs = {
      ...DEFAULTS,
      ...(parsed.prefs || {})
    };

    prefs.workDuration = clampNumber(Number(prefs.workDuration), 60, 180 * 60, DEFAULTS.workDuration);
    prefs.breakDuration = clampNumber(Number(prefs.breakDuration), 0, 90 * 60, DEFAULTS.breakDuration);
    prefs.dailyGoalSeconds = clampNumber(Number(prefs.dailyGoalSeconds), 15 * 60, 720 * 60, DEFAULTS.dailyGoalSeconds);
    prefs.mode = normalizeMode(prefs.mode);
    prefs.language = prefs.language === 'en' ? 'en' : 'tr';
    prefs.theme = normalizeTheme(prefs.theme);
    prefs.timerStyle = normalizeStyle(prefs.timerStyle);
    prefs.displayLayout = normalizeLayout(prefs.displayLayout);
    prefs.background = normalizeBackground(prefs.background);
    prefs.dailyGoalEnabled = normalizeBoolean(prefs.dailyGoalEnabled, DEFAULTS.dailyGoalEnabled);
    prefs.showTodayFocus = normalizeBoolean(prefs.showTodayFocus, DEFAULTS.showTodayFocus);
    prefs.showSeconds = normalizeBoolean(prefs.showSeconds, DEFAULTS.showSeconds);

    const daily = {};
    const legacyDays = parsed.stats?.daily || parsed.stats?.days || {};
    Object.keys(legacyDays).forEach((key) => {
      daily[key] = normalizeDayRecord(legacyDays[key]);
    });

    return {
      prefs,
      stats: {
        allTimeFocusSeconds: Number(parsed.stats?.allTimeFocusSeconds) || 0,
        allTimeSessions: Number(parsed.stats?.allTimeSessions) || deriveTotalSessions(daily),
        daily,
        recentSessions: Array.isArray(parsed.stats?.recentSessions)
          ? parsed.stats.recentSessions.map(normalizeRecentSession).filter(Boolean)
          : []
      }
    };
  }

  function createDefaultStore() {
    return {
      prefs: { ...DEFAULTS },
      stats: {
        allTimeFocusSeconds: 0,
        allTimeSessions: 0,
        daily: {},
        recentSessions: []
      }
    };
  }

  function normalizeDailyEntries(entries) {
    const daily = {};
    if (!Array.isArray(entries)) {
      return daily;
    }
    entries.forEach((entry) => {
      if (!Array.isArray(entry) || !entry[0]) {
        return;
      }
      daily[entry[0]] = {
        focusSeconds: Number(entry[1]) || 0,
        completedSessions: Number(entry[2]) || 0,
        countdownSeconds: Number(entry[3]) || 0,
        stopwatchSeconds: Number(entry[4]) || 0
      };
    });
    return daily;
  }

  function normalizeRecentSessions(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries.map(normalizeRecentSession).filter(Boolean);
  }

  function normalizeRecentSession(entry) {
    if (!entry) {
      return null;
    }

    if (Array.isArray(entry)) {
      return {
        date: entry[0],
        durationSeconds: Number(entry[1]) || 0,
        mode: entry[2] === 's' ? 'stopwatch' : 'countdown'
      };
    }

    if (typeof entry === 'object' && entry.date) {
      return {
        date: entry.date,
        durationSeconds: Number(entry.durationSeconds) || 0,
        mode: entry.mode === 'stopwatch' ? 'stopwatch' : 'countdown'
      };
    }

    return null;
  }

  function normalizeDayRecord(day) {
    return {
      focusSeconds: Number(day?.focusSeconds) || 0,
      completedSessions: Number(day?.completedSessions) || 0,
      countdownSeconds: Number(day?.countdownSeconds) || Number(day?.modeSeconds?.countdown) || Number(day?.focusSeconds) || 0,
      stopwatchSeconds: Number(day?.stopwatchSeconds) || Number(day?.modeSeconds?.stopwatch) || 0
    };
  }
  function saveStore() {
    pruneStore();
    const compact = compactStore();
    writeCookie(COOKIE_KEY, JSON.stringify(compact), 3650);
    writeLocalJSON(FALLBACK_KEY, compact);
  }

  function pruneStore() {
    // Keep all history; persistence is intentionally long-lived.
  }

  function compactStore() {
    const dailyEntries = Object.entries(store.stats.daily)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [
        key,
        value.focusSeconds,
        value.completedSessions,
        value.countdownSeconds,
        value.stopwatchSeconds
      ]);

    const recent = store.stats.recentSessions.map((session) => [
      session.date,
      session.durationSeconds,
      session.mode === 'stopwatch' ? 's' : 'c'
    ]);

    return {
      p: {
        m: store.prefs.mode,
        w: store.prefs.workDuration,
        b: store.prefs.breakDuration,
        ge: store.prefs.dailyGoalEnabled ? 1 : 0,
        g: store.prefs.dailyGoalSeconds,
        sf: store.prefs.showTodayFocus ? 1 : 0,
        ss: store.prefs.showSeconds ? 1 : 0,
        lg: store.prefs.language,
        t: store.prefs.theme,
        ty: store.prefs.timerStyle,
        l: store.prefs.displayLayout,
        bg: store.prefs.background
      },
      s: {
        a: store.stats.allTimeFocusSeconds,
        c: store.stats.allTimeSessions,
        d: dailyEntries,
        r: recent
      }
    };
  }

  function writeCookie(name, value, days) {
    try {
      const maxAge = days * 24 * 60 * 60;
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } catch {
      // File protocol may ignore cookies; local fallback covers it.
    }
  }

  function readCookieJSON(name) {
    try {
      const key = `${encodeURIComponent(name)}=`;
      const row = document.cookie.split('; ').find((item) => item.startsWith(key));
      if (!row) {
        return null;
      }
      return JSON.parse(decodeURIComponent(row.slice(key.length)));
    } catch {
      return null;
    }
  }

  function writeLocalJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function readLocalJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function deriveTotalSessions(daily) {
    return Object.values(daily).reduce((sum, day) => sum + (Number(day.completedSessions) || 0), 0);
  }

  function ensureToday() {
    const key = todayKey();
    state.lastDayKey = key;
    if (!store.stats.daily[key]) {
      store.stats.daily[key] = {
        focusSeconds: 0,
        completedSessions: 0,
        countdownSeconds: 0,
        stopwatchSeconds: 0
      };
      saveStore();
    }
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function getTodayStats() {
    ensureToday();
    return store.stats.daily[state.lastDayKey];
  }

  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    syncSidebar();
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    syncSidebar();
  }

  function syncSidebar() {
    el.body.classList.toggle('sidebar-open', state.sidebarOpen);
    el.menuButton.setAttribute('aria-expanded', String(state.sidebarOpen));
  }

  function openStatsPage() {
    state.statsOpen = true;
    closeSidebar();
    el.statsPage.hidden = false;
    el.body.classList.add('stats-open');
    safeCall(renderStatsPage);
  }

  function closeStatsPage() {
    state.statsOpen = false;
    el.statsPage.hidden = true;
    el.body.classList.remove('stats-open');
  }

  function setMode(nextMode) {
    if (!nextMode || nextMode === store.prefs.mode) {
      return;
    }

    pauseForModeSwitch();
    store.prefs.mode = nextMode;
    state.modeJustChanged = true;
    state.display.value = '';
    state.display.pairCount = 0;
    saveStore();
    renderAll();
  }

  function pauseForModeSwitch() {
    const now = Date.now();

    if (state.countdown.status === 'running') {
      state.countdown.remainingMs = Math.max(0, state.countdown.targetEnd - now);
      state.countdown.targetEnd = null;
      state.countdown.status = 'paused';
    }

    if (state.stopwatch.status === 'running') {
      state.stopwatch.displayMs = state.stopwatch.elapsedBeforeRun + (now - state.stopwatch.startedAt);
      state.stopwatch.elapsedBeforeRun = state.stopwatch.displayMs;
      state.stopwatch.startedAt = null;
      state.stopwatch.status = 'paused';
    }
  }

  function handleStart() {
    const now = Date.now();

    if (store.prefs.mode === 'clock') {
      return;
    }

    if (store.prefs.mode === 'countdown') {
      if (state.countdown.status === 'running') {
        return;
      }

      if (state.countdown.remainingMs <= 0) {
        primeCountdown(state.countdown.phase, false);
      }

      state.countdown.targetEnd = now + state.countdown.remainingMs;
      state.countdown.status = 'running';
      renderControls();
      return;
    }

    if (state.stopwatch.status === 'completed') {
      state.stopwatch.elapsedBeforeRun = 0;
      state.stopwatch.displayMs = 0;
      state.stopwatch.startedAt = null;
      state.stopwatch.status = 'idle';
    }

    state.stopwatch.startedAt = now;
    state.stopwatch.status = 'running';
    renderControls();
  }

  function handleStop() {
    const now = Date.now();

    if (store.prefs.mode === 'countdown') {
      if (state.countdown.status !== 'running') {
        return;
      }

      state.countdown.remainingMs = Math.max(0, state.countdown.targetEnd - now);
      state.countdown.targetEnd = null;
      state.countdown.status = 'paused';
      renderAll();
      return;
    }

    if (store.prefs.mode === 'stopwatch') {
      if (state.stopwatch.status !== 'running') {
        return;
      }

      state.stopwatch.displayMs = state.stopwatch.elapsedBeforeRun + (now - state.stopwatch.startedAt);
      state.stopwatch.elapsedBeforeRun = state.stopwatch.displayMs;
      state.stopwatch.startedAt = null;
      state.stopwatch.status = 'completed';

      const durationSeconds = Math.max(1, Math.floor(state.stopwatch.displayMs / 1000));
      addCompletedSession('stopwatch', durationSeconds);
      saveStore();
      pulse();
      renderAll();
    }
  }

  function handleCancel() {
    if (store.prefs.mode === 'countdown') {
      primeCountdown('work', false);
      renderAll();
      return;
    }

    if (store.prefs.mode === 'stopwatch') {
      state.stopwatch.status = 'idle';
      state.stopwatch.elapsedBeforeRun = 0;
      state.stopwatch.displayMs = 0;
      state.stopwatch.startedAt = null;
      state.display.value = '';
      state.display.pairCount = 0;
      renderAll();
    }
  }

  function primeCountdown(phase, keepPausedState) {
    const isBreak = phase === 'break' && store.prefs.breakDuration > 0;
    const durationSeconds = isBreak ? store.prefs.breakDuration : store.prefs.workDuration;

    state.countdown.phase = isBreak ? 'break' : 'work';
    state.countdown.sessionLengthMs = durationSeconds * 1000;
    state.countdown.remainingMs = durationSeconds * 1000;
    state.countdown.targetEnd = null;
    state.countdown.status = keepPausedState ? 'paused' : 'idle';
  }

  function finishCountdown() {
    if (state.countdown.phase === 'work') {
      addCompletedSession('countdown', store.prefs.workDuration);
      saveStore();
      pulse();

      if (store.prefs.breakDuration > 0) {
        primeCountdown('break', false);
        state.countdown.status = 'running';
        state.countdown.targetEnd = Date.now() + state.countdown.remainingMs;
      } else {
        primeCountdown('work', false);
      }
    } else {
      pulse();
      primeCountdown('work', false);
    }

    renderAll();
  }

  function addCompletedSession(mode, durationSeconds) {
    ensureToday();
    const today = getTodayStats();

    today.focusSeconds += durationSeconds;
    today.completedSessions += 1;
    if (mode === 'countdown') {
      today.countdownSeconds += durationSeconds;
    } else {
      today.stopwatchSeconds += durationSeconds;
    }

    store.stats.allTimeFocusSeconds += durationSeconds;
    store.stats.allTimeSessions += 1;
    store.stats.recentSessions.unshift({
      date: new Date().toISOString(),
      durationSeconds,
      mode
    });
    store.stats.recentSessions = store.stats.recentSessions.slice(0, 40);
  }

  function renderAll() {
    safeCall(syncInputs);
    safeCall(applyBodyClasses);
    safeCall(renderActiveOptions);
    safeCall(renderDisplay);
    safeCall(renderControls);
    safeCall(renderStats);
    safeCall(renderFootnote);
    safeCall(applyTranslations);
    if (state.statsOpen) {
      safeCall(renderStatsPage);
    }
    state.modeJustChanged = false;
  }

  function safeCall(fn) {
    try {
      fn();
    } catch (error) {
      console.error('focus-app', fn.name, error);
    }
  }

  function applyBodyClasses() {
    const body = el.body;
    ['theme-obsidian', 'theme-graphite', 'theme-cinder', 'theme-rose', 'theme-blush', 'theme-pearl', 'display-airy', 'display-balanced', 'display-defined', 'bg-midnight', 'bg-forest', 'bg-ocean', 'bg-dawn', 'bg-alpine', 'bg-sand', 'bg-rosewater', 'bg-petal', 'bg-berry'].forEach((className) => {
      body.classList.remove(className);
    });

    body.classList.add(`theme-${store.prefs.theme}`);
    body.classList.add(`display-${store.prefs.timerStyle}`);
    body.classList.add(`bg-${store.prefs.background}`);
    body.classList.toggle('sidebar-open', state.sidebarOpen);
    body.classList.toggle('stats-open', state.statsOpen);
  }

  function syncInputs() {
    el.workInput.value = String(Math.round(store.prefs.workDuration / 60));
    el.breakInput.value = String(Math.round(store.prefs.breakDuration / 60));
    el.goalToggle.checked = store.prefs.dailyGoalEnabled;
    el.goalInput.value = String(Math.round(store.prefs.dailyGoalSeconds / 60));
    el.showFocusToggle.checked = store.prefs.showTodayFocus;
    el.showSecondsToggle.checked = store.prefs.showSeconds;
  }

  function renderActiveOptions() {
    setActive(el.modeButtons, (button) => button.dataset.mode === store.prefs.mode);
    setActive(el.layoutButtons, (button) => button.dataset.layout === store.prefs.displayLayout);
    setActive(el.themeButtons, (button) => button.dataset.theme === store.prefs.theme);
    setActive(el.styleButtons, (button) => button.dataset.style === store.prefs.timerStyle);
    setActive(el.backgroundButtons, (button) => button.dataset.background === store.prefs.background);
    setActive(el.langButtons, (button) => button.dataset.language === store.prefs.language);
  }

  function setActive(buttons, matcher) {
    buttons.forEach((button) => {
      button.classList.toggle('is-active', matcher(button));
    });
  }

  const TRANSLATIONS = {
    tr: {
      title: 'Odak',
      openSidebar: 'Menuyu ac',
      sidebarAria: 'Odak ayarlari',
      controlsAria: 'Zamanlayici kontrolleri',
      stats: 'Istatistikler',
      language: 'Dil',
      modeSelection: 'Mod Secimi',
      timerSettings: 'Zamanlayici Ayarlari',
      dailyGoal: 'Gunluk Hedef',
      visibility: 'Gorunurluk',
      personalization: 'Kisisellestirme',
      totalFocusToday: 'Bugunku Toplam Odak',
      completedSessionsToday: 'Bugunku Tamamlanan Seans',
      allTimeFocus: 'Tum Zamanlar Odak',
      openDetailedStats: 'Detayli Istatistikler',
      countdownTimer: 'Geri Sayim',
      pomodoro: 'Pomodoro',
      stopwatch: 'Kronometre',
      countUp: 'Ileri Sayim',
      clock: 'Saat',
      liveTime: 'Canli Saat',
      workDuration: 'Calisma Suresi',
      workDurationCopy: 'Tamamlanan her odak seansi icin kullanilir.',
      breakDuration: 'Mola Suresi',
      breakDurationCopy: 'Calisma seansindan sonra otomatik baslar.',
      currentPhase: 'Gecerli Faz',
      focus: 'Odak',
      break: 'Mola',
      livePhase: 'Canli Saat',
      completed: 'Tamamlandi',
      enableDailyGoal: 'Gunluk Hedef',
      enableDailyGoalCopy: 'Gun icin sakin bir hedef tut.',
      goalDuration: 'Hedef Suresi',
      showSeconds: 'Saniyeyi Goster',
      showSecondsCopy: 'Saat, geri sayim ve kronometrede saniyeyi goster.',
      showTodayFocus: 'Bugunku Odagi Goster',
      showTodayFocusCopy: 'Kontrollerin altinda tek satir goster.',
      layout: 'Duzen',
      theme: 'Tema',
      display: 'Gorunum',
      background: 'Arka Plan',
      airy: 'Havadar',
      balanced: 'Dengeli',
      defined: 'Belirgin',
      start: 'Baslat',
      stop: 'Durdur',
      cancel: 'Iptal',
      todayFocusLabel: 'Bugunku Odak',
      analytics: 'Analitik',
      detailedFocusStats: 'Detayli Odak Istatistikleri',
      detailedStatsCopy: 'Trendler, son seanslar ve ilerleme icin ozel gorunum.',
      close: 'Kapat',
      today: 'Bugun',
      thisWeek: 'Bu Hafta',
      averageSession: 'Ortalama Seans',
      allTime: 'Tum Zamanlar',
      last7Days: 'Son 7 Gun',
      trend14: '14 Gunluk Trend',
      modeSplit: 'Mod Dagilimi',
      recentSessions: 'Son Seanslar',
      total: 'toplam',
      recorded: 'kaydedildi',
      noCompletedSessions: 'Henuz tamamlanan seans yok',
      countdown: 'Geri Sayim',
      stopwatchLabel: 'Kronometre',
      sessions: 'seans',
      dayStreak: 'gun seri',
      over14Days: '14 gunde',
      completedToday: 'bugun tamamlandi.',
      of: ' / ',
      min: 'dk'
    },
    en: {
      title: 'Focus', openSidebar: 'Open sidebar', sidebarAria: 'Focus settings', controlsAria: 'Timer controls', stats: 'Stats', language: 'Language', modeSelection: 'Mode Selection', timerSettings: 'Timer Settings', dailyGoal: 'Daily Goal', visibility: 'Visibility', personalization: 'Personalization', totalFocusToday: 'Total Focus Time Today', completedSessionsToday: 'Completed Sessions Today', allTimeFocus: 'All-Time Focus', openDetailedStats: 'Open Detailed Stats', countdownTimer: 'Countdown Timer', pomodoro: 'Pomodoro', stopwatch: 'Stopwatch', countUp: 'Count Up', clock: 'Clock', liveTime: 'Live Time', workDuration: 'Work Duration', workDurationCopy: 'Used for each completed countdown focus session.', breakDuration: 'Break Duration', breakDurationCopy: 'Starts automatically after a completed work session.', currentPhase: 'Current Phase', focus: 'Focus', break: 'Break', livePhase: 'Live Time', completed: 'Completed', enableDailyGoal: 'Enable Daily Goal', enableDailyGoalCopy: 'Keep one quiet target for the day.', goalDuration: 'Goal Duration', showSeconds: 'Show Seconds', showSecondsCopy: 'Include seconds in clock, countdown and stopwatch displays.', showTodayFocus: "Show Today's Focus", showTodayFocusCopy: 'Display a single muted line beneath the controls.', layout: 'Layout', theme: 'Theme', display: 'Display', background: 'Background', airy: 'Airy', balanced: 'Balanced', defined: 'Defined', start: 'Start', stop: 'Stop', cancel: 'Cancel', todayFocusLabel: "Today's Focus", analytics: 'Analytics', detailedFocusStats: 'Detailed Focus Stats', detailedStatsCopy: 'A dedicated view for trends, recent sessions and progress over time.', close: 'Close', today: 'Today', thisWeek: 'This Week', averageSession: 'Average Session', allTime: 'All-Time', last7Days: 'Last 7 Days', trend14: '14-Day Trend', modeSplit: 'Mode Split', recentSessions: 'Recent Sessions', total: 'total', recorded: 'recorded', noCompletedSessions: 'No completed sessions yet', countdown: 'Countdown', stopwatchLabel: 'Stopwatch', sessions: 'sessions', dayStreak: 'day streak', over14Days: 'over 14 days', completedToday: 'completed today.', of: ' of ', min: 'min'
    }
  };

  function t(key) {
    const lang = store.prefs.language === 'en' ? 'en' : 'tr';
    return TRANSLATIONS[lang][key] || TRANSLATIONS.en[key] || key;
  }

  function applyTranslations() {
    const lang = store.prefs.language === 'en' ? 'en' : 'tr';
    const panels = Array.from(document.querySelectorAll('.sidebar .panel'));
    document.documentElement.lang = lang;
    document.title = t('title');
    el.menuButton.setAttribute('aria-label', t('openSidebar'));
    el.sidebar.setAttribute('aria-label', t('sidebarAria'));
    el.controls.setAttribute('aria-label', t('controlsAria'));
    el.startButton.textContent = t('start');
    el.stopButton.textContent = t('stop');
    el.cancelButton.textContent = t('cancel');

    const panelTitles = Array.from(document.querySelectorAll('.panel-title'));
    if (panelTitles[0]) panelTitles[0].textContent = t('stats');
    if (panelTitles[1]) panelTitles[1].textContent = t('language');
    if (panelTitles[2]) panelTitles[2].textContent = t('modeSelection');
    if (panelTitles[3]) panelTitles[3].textContent = t('timerSettings');
    if (panelTitles[4]) panelTitles[4].textContent = t('dailyGoal');
    if (panelTitles[5]) panelTitles[5].textContent = t('visibility');
    if (panelTitles[6]) panelTitles[6].textContent = t('personalization');

    const statRows = Array.from(document.querySelectorAll('.panel--first .stat-row'));
    if (statRows[0]?.children[0]) statRows[0].children[0].textContent = t('totalFocusToday');
    if (statRows[1]?.children[0]) statRows[1].children[0].textContent = t('completedSessionsToday');
    if (statRows[2]?.children[0]) statRows[2].children[0].textContent = t('allTimeFocus');
    if (el.openStatsButton) el.openStatsButton.textContent = t('openDetailedStats');

    if (el.modeButtons[0]?.children[0]) {
      el.modeButtons[0].children[0].textContent = t('countdownTimer');
      el.modeButtons[0].children[1].textContent = t('pomodoro');
    }
    if (el.modeButtons[1]?.children[0]) {
      el.modeButtons[1].children[0].textContent = t('stopwatchLabel');
      el.modeButtons[1].children[1].textContent = t('countUp');
    }
    if (el.modeButtons[2]?.children[0]) {
      el.modeButtons[2].children[0].textContent = t('clock');
      el.modeButtons[2].children[1].textContent = t('liveTime');
    }

    const settingsRows = Array.from(panels[3]?.querySelectorAll('.row') || []);
    if (settingsRows[0]) {
      settingsRows[0].querySelector('strong').textContent = t('workDuration');
      settingsRows[0].querySelector('small').textContent = t('workDurationCopy');
    }
    if (settingsRows[1]) {
      settingsRows[1].querySelector('strong').textContent = t('breakDuration');
      settingsRows[1].querySelector('small').textContent = t('breakDurationCopy');
    }

    const phaseLabel = panels[3]?.querySelector('.stat-row span');
    if (phaseLabel) phaseLabel.textContent = t('currentPhase');

    const goalRows = Array.from(panels[4]?.querySelectorAll('.row') || []);
    if (goalRows[0]) {
      goalRows[0].querySelector('strong').textContent = t('enableDailyGoal');
      goalRows[0].querySelector('small').textContent = t('enableDailyGoalCopy');
    }
    if (goalRows[1]) {
      goalRows[1].querySelector('strong').textContent = t('goalDuration');
    }

    const visRows = Array.from(panels[5]?.querySelectorAll('.row') || []);
    if (visRows[0]) {
      visRows[0].querySelector('strong').textContent = t('showSeconds');
      visRows[0].querySelector('small').textContent = t('showSecondsCopy');
    }
    if (visRows[1]) {
      visRows[1].querySelector('strong').textContent = t('showTodayFocus');
      visRows[1].querySelector('small').textContent = t('showTodayFocusCopy');
    }

    const miniTitles = Array.from(document.querySelectorAll('.mini-section__title'));
    if (miniTitles[0]) miniTitles[0].textContent = t('layout');
    if (miniTitles[1]) miniTitles[1].textContent = t('theme');
    if (miniTitles[2]) miniTitles[2].textContent = t('display');
    if (miniTitles[3]) miniTitles[3].textContent = t('background');

    if (el.layoutButtons[0]) el.layoutButtons[0].textContent = 'Flip';
    if (el.layoutButtons[1]) el.layoutButtons[1].textContent = 'Classic';
    if (el.styleButtons[0]) el.styleButtons[0].textContent = t('airy');
    if (el.styleButtons[1]) el.styleButtons[1].textContent = t('balanced');
    if (el.styleButtons[2]) el.styleButtons[2].textContent = t('defined');

    if (el.langButtons[0]) {
      el.langButtons[0].textContent = String.fromCodePoint(0x1F1F9, 0x1F1F7);
      el.langButtons[0].setAttribute('title', lang === 'tr' ? 'Turkce' : 'Turkish');
      el.langButtons[0].setAttribute('aria-label', lang === 'tr' ? 'Turkce' : 'Turkish');
    }
    if (el.langButtons[1]) {
      el.langButtons[1].textContent = String.fromCodePoint(0x1F1FA, 0x1F1F8);
      el.langButtons[1].setAttribute('title', lang === 'tr' ? 'Ingilizce' : 'English');
      el.langButtons[1].setAttribute('aria-label', lang === 'tr' ? 'Ingilizce' : 'English');
    }

    const eyebrow = el.statsPage.querySelector('.eyebrow');
    const statsTitle = el.statsPage.querySelector('.stats-page__title');
    const statsCopy = el.statsPage.querySelector('.stats-page__copy');
    if (eyebrow) eyebrow.textContent = t('analytics');
    if (statsTitle) statsTitle.textContent = t('detailedFocusStats');
    if (statsCopy) statsCopy.textContent = t('detailedStatsCopy');
    el.closeStatsButton.textContent = t('close');

    const metricLabels = el.statsPage.querySelectorAll('.metric-card__label');
    if (metricLabels[0]) metricLabels[0].textContent = t('today');
    if (metricLabels[1]) metricLabels[1].textContent = t('thisWeek');
    if (metricLabels[2]) metricLabels[2].textContent = t('averageSession');
    if (metricLabels[3]) metricLabels[3].textContent = t('allTime');

    const blockHeaders = el.statsPage.querySelectorAll('.stats-block__header h3');
    if (blockHeaders[0]) blockHeaders[0].textContent = t('last7Days');
    if (blockHeaders[1]) blockHeaders[1].textContent = t('trend14');
    if (blockHeaders[2]) blockHeaders[2].textContent = t('modeSplit');
    if (blockHeaders[3]) blockHeaders[3].textContent = t('recentSessions');

    const legendLabels = el.statsPage.querySelectorAll('.legend-row span:nth-child(2)');
    if (legendLabels[0]) legendLabels[0].textContent = t('countdown');
    if (legendLabels[1]) legendLabels[1].textContent = t('stopwatchLabel');
  }
  function renderDisplay() {
    const view = getDisplayView();
    el.phaseValue.textContent = view.phase;

    if (store.prefs.displayLayout === 'classic') {
      el.classicDisplay.hidden = false;
      el.classicDisplay.setAttribute('aria-hidden', 'false');
      el.flipDisplay.hidden = true;
      el.flipDisplay.setAttribute('aria-hidden', 'true');
      el.classicDisplay.textContent = view.text;
      el.classicDisplay.classList.toggle('is-break', view.isBreak);
      return;
    }

    el.classicDisplay.hidden = true;
    el.classicDisplay.setAttribute('aria-hidden', 'true');
    el.flipDisplay.hidden = false;
    el.flipDisplay.setAttribute('aria-hidden', 'false');
    el.flipDisplay.classList.toggle('is-break', view.isBreak);

    const layoutChanged = state.display.pairCount !== view.pairs.length;
    const animate = !state.modeJustChanged && !layoutChanged && state.display.value !== '';
    applyFlipLayout(view.pairs.length);
    setFlipDisplayValue(view.pairs, animate);
    state.display.value = view.text;
    state.display.pairCount = view.pairs.length;
  }

  function getDisplayView() {
    if (store.prefs.mode === 'clock') {
      const now = new Date(state.clockNow);
      const pairs = store.prefs.showSeconds
        ? [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())]
        : [pad(now.getHours()), pad(now.getMinutes())];
      return {
        pairs,
        text: pairs.join(':'),
        isBreak: false,
        phase: t('livePhase')
      };
    }

    if (store.prefs.mode === 'stopwatch') {
      const pairs = formatDurationPairs(Math.floor(Math.max(0, state.stopwatch.displayMs) / 1000), store.prefs.showSeconds);
      return {
        pairs,
        text: pairs.join(':'),
        isBreak: false,
        phase: state.stopwatch.status === 'completed' ? t('completed') : t('focus')
      };
    }

    const pairs = formatDurationPairs(Math.ceil(Math.max(0, state.countdown.remainingMs) / 1000), store.prefs.showSeconds);
    return {
      pairs,
      text: pairs.join(':'),
      isBreak: state.countdown.phase === 'break',
      phase: state.countdown.phase === 'break' ? t('break') : t('focus')
    };
  }

  function formatDurationPairs(totalSeconds, includeSeconds) {
    const safeSeconds = Math.max(0, totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (!includeSeconds) {
      if (hours > 0) {
        return [pad(hours), pad(minutes)];
      }

      return [pad(Math.floor(safeSeconds / 60))];
    }

    if (hours > 0) {
      return [pad(hours), pad(minutes), pad(seconds)];
    }

    return [pad(Math.floor(safeSeconds / 60)), pad(seconds)];
  }

  function applyFlipLayout(pairCount) {
    el.flipGroups.forEach((group, index) => {
      group.hidden = index >= pairCount;
    });

    el.flipDividers.forEach((divider, index) => {
      divider.hidden = index >= pairCount - 1;
    });
  }

  function setFlipDisplayValue(pairs, animate) {
    const digits = pairs.join('').split('');
    digits.forEach((digit, index) => {
      setFlipDigit(el.flipSlots[index], digit, animate);
    });
  }

  function setFlipDigit(slot, nextValue, animate) {
    if (!slot) {
      return;
    }

    const hasCurrentValue = typeof slot.dataset.value === 'string' && slot.dataset.value !== '';
    if (!hasCurrentValue) {
      syncFlipDigit(slot, nextValue);
      return;
    }

    const currentValue = slot.dataset.value;
    if (currentValue === nextValue) {
      return;
    }

    if (!animate) {
      syncFlipDigit(slot, nextValue);
      return;
    }

    if (slot.classList.contains('is-flipping')) {
      syncFlipDigit(slot, slot.dataset.value || currentValue);
    }

    const topStatic = slot.querySelector('.flip-static--top span');
    const bottomStatic = slot.querySelector('.flip-static--bottom span');
    const topCurrent = slot.querySelector('.flip-flap--top .flip-runner__current');
    const topNext = slot.querySelector('.flip-flap--top .flip-runner__next');
    const bottomCurrent = slot.querySelector('.flip-flap--bottom .flip-runner__current');
    const bottomNext = slot.querySelector('.flip-flap--bottom .flip-runner__next');

    topStatic.textContent = currentValue;
    bottomStatic.textContent = currentValue;
    topCurrent.textContent = currentValue;
    topNext.textContent = currentValue;
    bottomCurrent.textContent = nextValue;
    bottomNext.textContent = nextValue;

    slot.classList.remove('is-flipping');
    void slot.offsetWidth;
    slot.classList.add('is-flipping');
    slot.dataset.value = nextValue;
    window.clearTimeout(slot._flipRevealTimer);
    slot._flipRevealTimer = window.setTimeout(() => {
      topStatic.textContent = nextValue;
      bottomStatic.textContent = nextValue;
    }, FLIP_REVEAL_DELAY_MS);
    window.clearTimeout(slot._flipTimer);
    slot._flipTimer = window.setTimeout(() => {
      syncFlipDigit(slot, nextValue);
    }, FLIP_DURATION_MS);
  }
  function syncFlipDigit(slot, value) {
    window.clearTimeout(slot._flipRevealTimer);
    window.clearTimeout(slot._flipTimer);
    slot.dataset.value = value;
    slot.querySelector('.flip-static--top span').textContent = value;
    slot.querySelector('.flip-static--bottom span').textContent = value;
    slot.querySelector('.flip-flap--top .flip-runner__current').textContent = value;
    slot.querySelector('.flip-flap--top .flip-runner__next').textContent = value;
    slot.querySelector('.flip-flap--bottom .flip-runner__current').textContent = value;
    slot.querySelector('.flip-flap--bottom .flip-runner__next').textContent = value;
    slot.classList.remove('is-flipping');
  }

  function renderControls() {
    el.startButton.textContent = t('start');
    el.stopButton.textContent = t('stop');
    el.cancelButton.textContent = t('cancel');

    if (store.prefs.mode === 'clock') {
      el.startButton.disabled = true;
      el.stopButton.disabled = true;
      el.cancelButton.disabled = true;
      return;
    }

    if (store.prefs.mode === 'countdown') {
      const fullyReset = state.countdown.status === 'idle'
        && state.countdown.phase === 'work'
        && state.countdown.remainingMs === store.prefs.workDuration * 1000;

      el.startButton.disabled = state.countdown.status === 'running';
      el.stopButton.disabled = state.countdown.status !== 'running';
      el.cancelButton.disabled = fullyReset;
      return;
    }

    el.startButton.disabled = state.stopwatch.status === 'running';
    el.stopButton.disabled = state.stopwatch.status !== 'running';
    el.cancelButton.disabled = state.stopwatch.status === 'idle' && state.stopwatch.displayMs === 0;
  }

  function renderStats() {
    const today = getTodayStats();
    el.todayFocus.textContent = formatFocus(today.focusSeconds);
    el.todaySessions.textContent = String(today.completedSessions);
    el.allTimeFocus.textContent = formatFocus(store.stats.allTimeFocusSeconds);
    el.goalCopy.textContent = store.prefs.dailyGoalEnabled
      ? `${formatFocus(today.focusSeconds)}${t('of')}${formatFocus(store.prefs.dailyGoalSeconds)} ${t('completedToday')}`
      : `${formatFocus(today.focusSeconds)} ${t('completedToday')}`;
  }

  function renderFootnote() {
    const today = getTodayStats();
    el.footnote.hidden = !store.prefs.showTodayFocus;
    el.footnote.textContent = `${t('todayFocusLabel')}: ${formatFocus(today.focusSeconds)}`;
  }

  function renderStatsPage() {
    const today = getTodayStats();
    const last7 = getRecentDays(7);
    const last14 = getRecentDays(14);
    const weekTotals = last7.reduce((acc, day) => {
      acc.focusSeconds += day.focusSeconds;
      acc.completedSessions += day.completedSessions;
      return acc;
    }, { focusSeconds: 0, completedSessions: 0 });

    const averageSession = store.stats.allTimeSessions > 0
      ? Math.round(store.stats.allTimeFocusSeconds / store.stats.allTimeSessions)
      : 0;

    el.metricTodayFocus.textContent = formatFocus(today.focusSeconds);
    el.metricTodaySessions.textContent = `${today.completedSessions} ${t('sessions')}`;
    el.metricWeekFocus.textContent = formatFocus(weekTotals.focusSeconds);
    el.metricWeekSessions.textContent = `${weekTotals.completedSessions} ${t('sessions')}`;
    el.metricAverageSession.textContent = formatShortDuration(averageSession);
    el.metricStreak.textContent = `${getCurrentStreak()} ${t('dayStreak')}`;
    el.metricAllTimeFocus.textContent = formatFocus(store.stats.allTimeFocusSeconds);
    el.metricAllTimeSessions.textContent = `${store.stats.allTimeSessions} ${t('sessions')}`;
    el.weeklyFocusSummary.textContent = `${formatFocus(weekTotals.focusSeconds)} ${t('total')}`;
    el.trendFocusSummary.textContent = `${formatFocus(last14.reduce((sum, day) => sum + day.focusSeconds, 0))} ${t('over14Days')}`;

    renderWeeklyBars(last7);
    renderTrendChart(last14);
    renderModeChart();
    renderRecentSessions();
  }

  function renderWeeklyBars(days) {
    const maxFocus = Math.max(...days.map((day) => day.focusSeconds), 1);
    el.weeklyBars.innerHTML = '';

    const fragment = document.createDocumentFragment();
    days.forEach((day) => {
      const column = document.createElement('div');
      column.className = 'bar-chart__column';

      const value = document.createElement('div');
      value.className = 'bar-chart__value';
      value.textContent = day.focusSeconds > 0 ? formatCompactFocus(day.focusSeconds) : '0m';

      const track = document.createElement('div');
      track.className = 'bar-chart__track';
      const fill = document.createElement('div');
      fill.className = 'bar-chart__fill';
      fill.style.height = `${day.focusSeconds > 0 ? Math.max((day.focusSeconds / maxFocus) * 100, 6) : 2}%`;
      track.appendChild(fill);

      const label = document.createElement('div');
      label.className = 'bar-chart__label';
      label.textContent = day.label;

      column.append(value, track, label);
      fragment.appendChild(column);
    });

    el.weeklyBars.appendChild(fragment);
  }

  function renderTrendChart(days) {
    const width = 720;
    const height = 220;
    const paddingX = 24;
    const paddingTop = 18;
    const paddingBottom = 26;
    const maxFocus = Math.max(...days.map((day) => day.focusSeconds), 1);
    const stepX = days.length > 1 ? (width - paddingX * 2) / (days.length - 1) : 0;

    const points = days.map((day, index) => ({
      day,
      x: paddingX + stepX * index,
      y: height - paddingBottom - ((day.focusSeconds / maxFocus) * (height - paddingTop - paddingBottom))
    }));

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    el.trendLine.setAttribute('d', linePath);
    el.trendArea.setAttribute('d', areaPath);
    el.trendDots.innerHTML = points.map((point) => `<circle class='line-chart__dot' cx='${point.x}' cy='${point.y}' r='4'></circle>`).join('');

    const labels = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
      .filter(Boolean)
      .map((point) => point.day.label);

    el.trendLabels.innerHTML = labels.map((label) => `<span>${label}</span>`).join('');
  }

  function renderModeChart() {
    const totals = Object.values(store.stats.daily).reduce((acc, day) => {
      acc.countdown += day.countdownSeconds || 0;
      acc.stopwatch += day.stopwatchSeconds || 0;
      return acc;
    }, { countdown: 0, stopwatch: 0 });

    const total = totals.countdown + totals.stopwatch;
    const countdownPercent = total > 0 ? Math.round((totals.countdown / total) * 100) : 0;
    const countdownDegrees = total > 0 ? (totals.countdown / total) * 360 : 0;

    el.modeRing.style.background = total > 0
      ? `conic-gradient(var(--accent-solid) 0deg ${countdownDegrees}deg, rgba(255,255,255,0.18) ${countdownDegrees}deg 360deg)`
      : 'conic-gradient(rgba(255,255,255,0.14) 0deg 360deg)';

    el.modeRingValue.textContent = formatCompactFocus(total);
    el.modeSplitSummary.textContent = total > 0 ? `${formatFocus(total)} ${t('recorded')}` : t('noCompletedSessions');
    el.countdownSplitValue.textContent = `${countdownPercent}%`;
    el.stopwatchSplitValue.textContent = `${100 - countdownPercent}%`;
  }

  function renderRecentSessions() {
    const sessions = store.stats.recentSessions.slice(0, 10);
    el.recentSessionsSummary.textContent = sessions.length > 0
      ? `${sessions.length} ${t('recentSessions').toLowerCase()}`
      : t('noCompletedSessions');
    el.recentSessionsList.innerHTML = '';

    if (sessions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'session-item';
      empty.innerHTML = `<div class='session-item__meta'><span>${t('noCompletedSessions')}</span></div><span class='session-item__value'>-</span>`;
      el.recentSessionsList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'session-item';
      item.innerHTML = `
        <div class='session-item__meta'>
          <strong>${session.mode === 'countdown' ? t('countdown') : t('stopwatchLabel')}</strong>
          <span>${formatRecentDate(session.date)} ${formatRecentTime(session.date)}</span>
        </div>
        <span class='session-item__value'>${formatShortDuration(session.durationSeconds)}</span>
      `;
      fragment.appendChild(item);
    });

    el.recentSessionsList.appendChild(fragment);
  }
  function getRecentDays(count) {
    const days = [];
    for (let index = count - 1; index >= 0; index -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);
      const key = formatDateKey(date);
      const record = store.stats.daily[key] || {
        focusSeconds: 0,
        completedSessions: 0,
        countdownSeconds: 0,
        stopwatchSeconds: 0
      };
      days.push({
        key,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        focusSeconds: record.focusSeconds,
        completedSessions: record.completedSessions,
        countdownSeconds: record.countdownSeconds,
        stopwatchSeconds: record.stopwatchSeconds
      });
    }
    return days;
  }

  function getCurrentStreak() {
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (true) {
      const key = formatDateKey(cursor);
      const day = store.stats.daily[key];
      if (!day || day.focusSeconds <= 0) {
        break;
      }
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatFocus(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  function formatCompactFocus(totalSeconds) {
    if (totalSeconds >= 3600) {
      return `${(totalSeconds / 3600).toFixed(totalSeconds % 3600 === 0 ? 0 : 1)}h`;
    }
    return `${Math.max(0, Math.round(totalSeconds / 60))}m`;
  }

  function formatShortDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  function formatRecentDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString(store.prefs.language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' });
  }

  function formatRecentTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString(store.prefs.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(numeric)));
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function pulse() {
    window.clearTimeout(state.pulseTimer);
    el.mainShell.classList.remove('is-pulsing');
    void el.mainShell.offsetWidth;
    el.mainShell.classList.add('is-pulsing');
    state.pulseTimer = window.setTimeout(() => {
      el.mainShell.classList.remove('is-pulsing');
    }, 940);
  }
})();

































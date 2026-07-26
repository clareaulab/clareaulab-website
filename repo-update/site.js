// ---------------------------------------------------------------------------
// site.js — shared "chrome" and helpers for every page of the Lareau Lab site.
//
// This is the ONE place to edit site-wide things:
//   • SITE.nav     — the navigation bar links (used by every page)
//   • SITE.footer  — the footer text (used by every page)
//   • helpers      — the markdown/emoji text helpers used by Team and News
//
// It is loaded via <script src="./site.js"></script> in each page's <head>.
// It defines a single global, window.SITE, that the page scripts read from.
// ---------------------------------------------------------------------------
(function () {
  var SITE = {

    // --- Navigation bar: edit labels / links here, once. ---------------------
    // Every page's nav is generated from this list. Use "#" for a placeholder
    // link that doesn't go anywhere yet.
    nav: [
      { label: 'Home', href: './' },
      { label: 'Team', href: 'team.html' },
      { label: 'News', href: 'news.html' },
      { label: 'Research', href: 'research.html' },
      { label: 'Publications', href: 'publications.html' },
      { label: 'Contact', href: 'contact.html' },
    ],

    // --- Footer text: edit once, shows on every page. ------------------------
    footer: {
      name: 'Lareau Lab',
      // Non-breaking spaces keep "Memorial Sloan Kettering Cancer Center" together,
      // so on narrow screens it wraps as one unit instead of orphaning "Memorial".
      org: 'Computational and Systems Biology Program · Memorial Sloan Kettering Cancer Center',
      url: 'clareaulab.com',
    },

    // --- Nav pill styling for the inner (light) pages. -----------------------
    // The `active` pill (current page) is dark; the rest are outlined.
    navStyle: function (active) {
      return {
        fontFamily: "'Space Mono', monospace", fontSize: '12px', letterSpacing: '.08em',
        textTransform: 'uppercase', padding: '9px 15px', borderRadius: '999px',
        color: active ? 'var(--pill-active-fg)' : 'var(--pill-fg)',
        background: active ? 'var(--pill-active-bg)' : 'transparent',
        border: active ? '1px solid var(--pill-active-bg)' : '1px solid var(--line-3)',
      };
    },

    // Returns the nav list with `active` + inline `style` computed for the
    // given current page (e.g. 'team.html'). Used by the inner pages.
    navItems: function (currentHref) {
      return this.nav.map(function (n) {
        var active = n.href === currentHref;
        return { label: n.label, href: n.href, active: active, style: SITE.navStyle(active) };
      });
    },

    // --- Emoji shortcodes used in Team bios (":pizza:" -> 🍕). ---------------
    EMOJI: {
      ':pizza:': '🍕', ':cookie:': '🍪', ':cake:': '🍰', ':bread:': '🍞', ':coffee:': '☕',
      ':book:': '📖', ':soccer:': '⚽', ':man_juggling:': '🤹‍♂️', ':dog:': '🐶',
      ':tennis:': '🎾', ':art:': '🎨', ':airplane:': '✈️', ':hibiscus:': '🌺', ':seedling:': '🌱',
      ':blossom:': '🌼', ':four_leaf_clover:': '🍀', ':cherry_blossom:': '🌸', ':palm_tree:': '🌴',
      ':ping_pong:': '🏓', ':table_tennis_paddle_and_ball:': '🏓', ':woman_climbing:': '🧗‍♀️',
      ':shallow_pan_of_food:': '🥘',
    },

    // Team bios: light markdown -> HTML (the Team modal renders the result as
    // HTML). Emoji shortcodes become emoji; markdown [links](url) become <a>
    // tags and _italics_ become <em>. Plain text is HTML-escaped first so it
    // renders safely.
    clean: function (t) {
      var s = (t || '').replace(/\s+/g, ' ');
      s = s.replace(/&nbsp;/g, ' ');
      s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var EMO = SITE.EMOJI;
      Object.keys(EMO).forEach(function (k) { s = s.split(k).join(EMO[k]); });
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener" style="color:var(--accent);border-bottom:1px solid var(--accent-line)">$1</a>');
      s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
      s = s.replace(/ ([!.,?])/g, '$1');
      return s.replace(/\s{2,}/g, ' ').trim();
    },

    // News bodies: light markdown -> HTML. Links become <a>, _italics_ become
    // <em>; emoji shortcodes are removed (News doesn't render them).
    md: function (s) {
      var h = (s || '').replace(/:[a-z0-9_+\-]+:/g, '').replace(/&nbsp;/g, ' ');
      h = h.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
      h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--accent);border-bottom:1px solid var(--accent-line)">$1</a>');
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/_([^_]+)_/g, '<em>$1</em>');
      h = h.replace(/\s+/g, ' ').trim();
      return h;
    },

    // --- Light / Dark / Auto ------------------------------------------------
    // The mode ('light' | 'dark' | 'auto') is stored in localStorage; 'auto'
    // follows the device. An inline script in each page's <head> applies it
    // before first paint, so there is no flash. Everything visual resolves
    // through the CSS custom properties at the top of styles.css.
    THEME_KEY: 'lareau-theme',
    _themeSubs: [],

    theme: {
      get mode() {
        try { return localStorage.getItem(SITE.THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
      },
      get resolved() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      },
      prefersDark: function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      },
      apply: function () {
        var mode = SITE.theme.mode;
        var dark = mode === 'dark' || (mode === 'auto' && SITE.theme.prefersDark());
        var r = document.documentElement;
        r.setAttribute('data-theme', dark ? 'dark' : 'light');
        r.setAttribute('data-theme-mode', mode);
        if (window.BS && window.BS.retheme) window.BS.retheme();
        SITE._themeSubs.forEach(function (fn) { try { fn(mode, dark ? 'dark' : 'light'); } catch (e) {} });
      },
      set: function (mode) {
        try { localStorage.setItem(SITE.THEME_KEY, mode); } catch (e) {}
        SITE.theme.apply();
      },
      init: function () {
        if (SITE.theme._inited) return;
        SITE.theme._inited = true;
        if (window.matchMedia) {
          var mq = window.matchMedia('(prefers-color-scheme: dark)');
          var onChange = function () { if (SITE.theme.mode === 'auto') SITE.theme.apply(); };
          if (mq.addEventListener) mq.addEventListener('change', onChange);
          else if (mq.addListener) mq.addListener(onChange);
        }
        // another tab changed it
        window.addEventListener('storage', function (e) {
          if (e.key === SITE.THEME_KEY) SITE.theme.apply();
        });
        SITE.theme.apply();
      },
    },

    // Components (the footer) subscribe to re-render when the mode changes.
    onTheme: function (fn) {
      SITE._themeSubs.push(fn);
      return function () { SITE._themeSubs = SITE._themeSubs.filter(function (f) { return f !== fn; }); };
    },

    // --- Load and parse a YAML content file (lazy-loads js-yaml if needed). --
    loadYaml: function (path) {
      return SITE._ensureYaml().then(function () {
        return fetch(path, { cache: 'no-store' }).then(function (r) {
          if (!r.ok) throw new Error('Could not load ' + path + ' (' + r.status + ').');
          return r.text();
        });
      }).then(function (text) {
        return window.jsyaml.load(text) || [];
      });
    },

    _ensureYaml: function () {
      if (window.jsyaml) return Promise.resolve();
      if (SITE._yamlPromise) return SITE._yamlPromise;
      SITE._yamlPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
        s.onload = resolve;
        s.onerror = function () { reject(new Error('YAML parser failed to load.')); };
        document.head.appendChild(s);
      });
      return SITE._yamlPromise;
    },
  };

  window.SITE = SITE;
  SITE.theme.init();
})();

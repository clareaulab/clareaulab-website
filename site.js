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
      { label: 'Home', href: 'Home.dc.html' },
      { label: 'News', href: 'News.dc.html' },
      { label: 'Team', href: 'Team.dc.html' },
      { label: 'Research', href: '#' },
      { label: 'Publications', href: 'Publications.dc.html' },
      { label: 'Contact', href: 'Contact.dc.html' },
    ],

    // --- Footer text: edit once, shows on every page. ------------------------
    footer: {
      name: 'Lareau Lab',
      org: 'Memorial Sloan Kettering Cancer Center · Zuckerman Research Center, New York, NY',
      url: 'clareaulab.com',
    },

    // --- Nav pill styling for the inner (light) pages. -----------------------
    // The `active` pill (current page) is dark; the rest are outlined.
    navStyle: function (active) {
      return {
        fontFamily: "'Space Mono', monospace", fontSize: '12px', letterSpacing: '.08em',
        textTransform: 'uppercase', padding: '9px 15px', borderRadius: '999px',
        color: active ? '#f4fbff' : '#24425c',
        background: active ? '#0f2a3f' : 'transparent',
        border: active ? '1px solid #0f2a3f' : '1px solid rgba(57,99,175,.16)',
      };
    },

    // Returns the nav list with `active` + inline `style` computed for the
    // given current page (e.g. 'Team.dc.html'). Used by the inner pages.
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
    },

    // Team bios: plain text. Emoji shortcodes become emoji; markdown links and
    // _italics_ are stripped to plain text (the Team modal shows bios as text).
    clean: function (t) {
      var s = (t || '').replace(/\s+/g, ' ');
      s = s.replace(/&nbsp;/g, ' ');
      s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      var EMO = SITE.EMOJI;
      Object.keys(EMO).forEach(function (k) { s = s.split(k).join(EMO[k]); });
      s = s.replace(/_([^_\n]+)_/g, '$1');
      s = s.replace(/ ([!.,?])/g, '$1');
      return s.replace(/\s{2,}/g, ' ').trim();
    },

    // News bodies: light markdown -> HTML. Links become <a>, _italics_ become
    // <em>; emoji shortcodes are removed (News doesn't render them).
    md: function (s) {
      var h = (s || '').replace(/:[a-z0-9_+\-]+:/g, '').replace(/&nbsp;/g, ' ');
      h = h.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
      h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#0091c7;border-bottom:1px solid rgba(0,145,199,.35)">$1</a>');
      h = h.replace(/_([^_]+)_/g, '<em>$1</em>');
      h = h.replace(/\s+/g, ' ').trim();
      return h;
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
})();

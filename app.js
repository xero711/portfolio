/* =========================================================
   xero portfolio — app.js
   Scene navigation (hash-based panels), companion reactions,
   projects rendering from ./data/projects.json.
   Vanilla JS only. No external libraries.
   ========================================================= */
(function () {
  'use strict';

  window.__xeroReady = true;

  var root = document.documentElement;
  root.classList.add('js'); // 低速回線でフェイルセーフが先に発火した場合の復帰
  var body = document.body;

  function media(q) {
    return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: null };
  }
  var motionQuery = media('(prefers-reduced-motion: reduce)');
  var finePointer = media('(pointer: fine)');
  var reduceMotion = motionQuery.matches;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------------------------------------------------
     Scene image: fade in once loaded. If missing, the CSS
     gradient fallback stays and fringe layers stay off.
     --------------------------------------------------------- */
  (function sceneImage() {
    var img = new Image();
    img.onload = function () { root.classList.add('scene-ready'); };
    img.onerror = function () { root.classList.add('scene-missing'); };
    img.src = './assets/city-night.png';
  })();

  /* ---------------------------------------------------------
     Companion status line
     --------------------------------------------------------- */
  var statusNode = $('[data-companion-status]');
  function setStatus(text) { if (statusNode) statusNode.textContent = text; }

  /* ---------------------------------------------------------
     Router: #apps / #games / #about / #contact open a panel,
     #top or no hash returns to the scene.
     --------------------------------------------------------- */
  var BASE_TITLE = document.title;
  var panels = {};
  $$('[data-panel]').forEach(function (p) { panels[p.id] = p; });
  var menuLinks = $$('[data-menu-link]');
  var home = $('#top');
  var main = $('#main');
  var current = null; // null = home scene

  function idFromHash(hash) {
    var id = String(hash || '').replace(/^#/, '');
    try { id = decodeURIComponent(id); } catch (e) { /* noop */ }
    return Object.prototype.hasOwnProperty.call(panels, id) ? id : null;
  }
  function isHomeHash(hash) { return !hash || hash === '#' || hash === '#top'; }

  function setInert(node, on) {
    if (!node) return;
    if (on) node.setAttribute('inert', '');
    else node.removeAttribute('inert');
  }

  function focusNode(node) {
    if (!node) return;
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  function linkFor(id) {
    for (var i = 0; i < menuLinks.length; i++) {
      if (menuLinks[i].getAttribute('href') === '#' + id) return menuLinks[i];
    }
    return null;
  }

  function route(id, opts) {
    opts = opts || {};
    var prev = current;
    current = id;
    body.setAttribute('data-view', id || 'home');

    Object.keys(panels).forEach(function (key) {
      var p = panels[key];
      var on = key === id;
      p.classList.toggle('is-active', on);
      setInert(p, !on);
    });
    setInert(home, !!id);

    menuLinks.forEach(function (a) {
      if (id && a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    document.title = id ? (panels[id].getAttribute('data-title') || id) + ' — ' + BASE_TITLE : BASE_TITLE;
    setStatus(id ? 'open: ' + id : 'standby');

    if (id) {
      var frame = $('.panel__frame', panels[id]);
      if (frame && prev !== id) frame.scrollTop = 0;
      if (opts.focus) focusNode($('[data-panel-title]', panels[id]));
    } else if (opts.focus) {
      focusNode((prev && linkFor(prev)) || menuLinks[0]);
    }
  }

  function go(id, focus) {
    if (id === current) {
      if (focus && id) focusNode($('[data-panel-title]', panels[id]));
      return;
    }
    var url = id ? '#' + id : location.pathname + location.search;
    try {
      history.pushState({ view: id }, '', url);
    } catch (e) {
      location.hash = id || 'top';
      return;
    }
    route(id, { focus: focus });
  }

  function syncFromLocation() {
    var h = location.hash;
    var id = idFromHash(h);
    if (!id && !isHomeHash(h)) return; // 未知のアンカーは無視
    if (id !== current) route(id, { focus: true });
  }
  window.addEventListener('popstate', syncFromLocation);
  window.addEventListener('hashchange', syncFromLocation);

  // 同一ページ内リンクをすべてルーターで処理
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute('href');

    if (a.hasAttribute('data-skip')) {
      e.preventDefault();
      focusNode(current ? $('[data-panel-title]', panels[current]) : main);
      return;
    }
    var id = idFromHash(href);
    if (id) { e.preventDefault(); go(id, true); return; }
    if (isHomeHash(href)) { e.preventDefault(); go(null, true); }
  });

  // Esc でシーンへ戻る / メニュー内は矢印キーでも移動
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current) {
      e.preventDefault();
      go(null, true);
    }
  });

  var menuList = $('[data-menu]');
  if (menuList) {
    menuList.addEventListener('keydown', function (e) {
      var i = menuLinks.indexOf(document.activeElement);
      if (i < 0) return;
      var n = menuLinks.length;
      switch (e.key) {
        case 'ArrowDown': case 'ArrowRight': i = (i + 1) % n; break;
        case 'ArrowUp': case 'ArrowLeft': i = (i - 1 + n) % n; break;
        case 'Home': i = 0; break;
        case 'End': i = n - 1; break;
        default: return;
      }
      e.preventDefault();
      menuLinks[i].focus();
    });

    // コンパニオンがメニューを「見る」
    var peekTimer = 0;
    function peek(link) {
      clearTimeout(peekTimer);
      body.setAttribute('data-peek', 'menu');
      var label = $('.menu__en', link);
      setStatus('select: ' + (label ? label.textContent.toLowerCase() : ''));
    }
    function unpeek() {
      peekTimer = setTimeout(function () {
        body.removeAttribute('data-peek');
        setStatus(current ? 'open: ' + current : 'standby');
      }, 120);
    }
    menuLinks.forEach(function (link) {
      link.addEventListener('pointerenter', function () { peek(link); });
      link.addEventListener('pointerleave', unpeek);
      link.addEventListener('focus', function () { peek(link); });
      link.addEventListener('blur', unpeek);
    });
  }

  // 初期表示（直リンク #about 等に対応、アニメーションなし）
  route(idFromHash(location.hash), { focus: false });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.remove('no-anim'); });
  });

  /* ---------------------------------------------------------
     Pointer parallax (scene + companion), fine pointers only
     --------------------------------------------------------- */
  (function parallax() {
    var targets = [$('.scene'), $('.companion')].filter(Boolean);
    if (!targets.length) return;
    var tx = 0, ty = 0, x = 0, y = 0, raf = 0;

    function apply() {
      targets.forEach(function (t) {
        t.style.setProperty('--px', x.toFixed(3));
        t.style.setProperty('--py', y.toFixed(3));
      });
    }
    function loop() {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      apply();
      if (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) raf = requestAnimationFrame(loop);
      else raf = 0;
    }
    window.addEventListener('pointermove', function (e) {
      if (reduceMotion || !finePointer.matches) return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', function () {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });

    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', function (e) {
        reduceMotion = e.matches;
        if (reduceMotion) { tx = ty = x = y = 0; apply(); }
      });
    }
  })();

  /* ---------------------------------------------------------
     Projects: ./data/projects.json
     静的 HTML に同じ内容が入っているため、読み込み失敗時もそのまま表示
     --------------------------------------------------------- */
  var CATEGORY_ALIASES = {
    games: 'games', game: 'games', 'ゲーム': 'games',
    apps: 'apps', app: 'apps', application: 'apps', applications: 'apps', 'アプリ': 'apps'
  };
  var EMPTY = {
    games: '公開中のゲーム作品は、いまはありません。',
    apps: '公開中のアプリは準備中です。'
  };

  function str(v) { return v == null ? '' : String(v).trim(); }

  function pick(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== '') return obj[keys[i]];
    }
    return null;
  }

  /** http(s) または相対パスのみ許可。'#'・javascript: 等は除外 */
  function safeUrl(value) {
    var v = str(value);
    if (!v || v.charAt(0) === '#') return null;
    try {
      var hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(v);
      var u = new URL(v, location.href);
      if (hasScheme || v.indexOf('//') === 0) {
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
        if (/(^|\.)example\.(com|org|net)$/i.test(u.hostname)) return null;
      }
      return hasScheme ? u.href : v;
    } catch (e) {
      return null;
    }
  }

  function isExternal(url) {
    try { return new URL(url, location.href).origin !== location.origin; } catch (e) { return false; }
  }
  function isGitHub(url) {
    try { return /(^|\.)github\.com$/i.test(new URL(url, location.href).hostname); } catch (e) { return false; }
  }

  function isSampleFlag(p) {
    var flag = pick(p, ['sample', 'isSample', 'placeholder', 'isPlaceholder', 'dummy']);
    if (flag === true || flag === 'true' || flag === 1) return true;
    var status = str(p.status).toLowerCase();
    return status === 'sample' || status === 'placeholder' || status === 'draft';
  }

  function normalizeProject(p) {
    if (!p || typeof p !== 'object') return null;
    var title = str(pick(p, ['title', 'name', 'titleJa']));
    if (!title) return null;
    var rawCat = str(pick(p, ['category', 'type', 'section', 'kind'])).toLowerCase();
    var tags = pick(p, ['tags', 'tech', 'stack', 'tools']);
    if (typeof tags === 'string') tags = tags.split(/[,、]/);
    if (!Array.isArray(tags)) tags = [];
    var sample = isSampleFlag(p);
    return {
      title: title,
      category: CATEGORY_ALIASES[rawCat] || 'other',
      year: str(pick(p, ['year', 'date', 'period'])),
      role: str(pick(p, ['role', 'roles', 'position'])),
      client: str(pick(p, ['client'])),
      description: str(pick(p, ['description', 'summary', 'desc', 'overview'])),
      tags: tags.map(str).filter(Boolean).slice(0, 8),
      url: sample ? null : safeUrl(pick(p, ['url', 'link', 'href', 'website'])),
      sample: sample
    };
  }

  function buildEntry(p, index, group, headingTag) {
    var li = el('li', 'entry' + (p.sample ? ' is-sample' : ''));
    var titleId = 'entry-' + group + '-' + index;
    var card = el('article', 'entry__card');
    card.setAttribute('aria-labelledby', titleId);

    var no = el('p', 'entry__no', pad2(index + 1));
    no.setAttribute('aria-hidden', 'true');
    card.appendChild(no);

    var mainEl = el('div', 'entry__main');
    var h = el(headingTag, 'entry__title', p.title);
    h.id = titleId;
    mainEl.appendChild(h);

    if (p.sample || p.year || p.role || p.client) {
      var meta = el('p', 'entry__meta');
      if (p.sample) meta.appendChild(el('span', 'badge', 'サンプル'));
      if (p.year) meta.appendChild(el('span', null, p.year));
      if (p.role) meta.appendChild(el('span', null, p.role));
      if (p.client) meta.appendChild(el('span', null, 'Client: ' + p.client));
      mainEl.appendChild(meta);
    }
    if (p.description) mainEl.appendChild(el('p', 'entry__desc', p.description));
    if (p.tags.length) {
      var tags = el('ul', 'entry__tags');
      tags.setAttribute('aria-label', 'タグ');
      p.tags.forEach(function (t) { tags.appendChild(el('li', null, t)); });
      mainEl.appendChild(tags);
    }
    card.appendChild(mainEl);

    var action = el('p', 'entry__action');
    if (p.url) {
      var a = el('a', 'entry__link', isGitHub(p.url) ? 'GitHub' : 'Open');
      a.href = p.url;
      var externalNote = '';
      if (/^https?:/i.test(p.url) && isExternal(p.url)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        externalNote = '（新しいタブで開きます）';
      }
      a.appendChild(el('span', 'visually-hidden', '：' + p.title + externalNote));
      var arrow = el('span', null, '↗');
      arrow.setAttribute('aria-hidden', 'true');
      a.appendChild(arrow);
      action.appendChild(a);
    } else {
      action.appendChild(el('span', 'entry__private', 'Private'));
    }
    card.appendChild(action);

    li.appendChild(card);
    return li;
  }

  function setNote(message, badge) {
    var note = $('[data-projects-status]');
    if (!note) return;
    note.textContent = '';
    note.hidden = !message;
    if (!message) return;
    note.appendChild(el('span', 'badge', badge));
    note.appendChild(document.createTextNode(message));
  }

  function renderProjects(list) {
    var groups = { apps: [], games: [], other: [] };
    list.forEach(function (p) { (groups[p.category] || groups.other).push(p); });

    Object.keys(groups).forEach(function (key) {
      var ul = $('[data-list="' + key + '"]');
      if (!ul) return;
      var items = groups[key];
      ul.textContent = '';
      if (key === 'other') {
        var g = $('[data-group="other"]');
        if (g) g.hidden = items.length === 0;
      }
      if (!items.length) {
        if (EMPTY[key]) ul.appendChild(el('li', 'entries__empty', EMPTY[key]));
      } else {
        items.forEach(function (p, i) {
          ul.appendChild(buildEntry(p, i, key, key === 'other' ? 'h4' : 'h3'));
        });
      }
      var count = $('[data-count="' + key + '"]');
      if (count) count.textContent = pad2(items.length);
    });

    var samples = list.filter(function (p) { return p.sample; }).length;
    if (samples === 0) setNote('');
    else if (samples === list.length) setNote('表示中の項目はすべてサンプル（仮）です。', 'Sample');
    else setNote('「サンプル」表示の項目は仮のプレースホルダーです。', 'Note');
  }

  /* 連絡先は GitHub のみ表示 */
  function renderContact(data) {
    var listEl = $('[data-contact-links]');
    if (!listEl || !data || typeof data !== 'object' || Array.isArray(data)) return;
    var raw = pick(data, ['contact', 'contacts', 'links']);
    if (!Array.isArray(raw)) return;
    var items = [];
    raw.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var href = safeUrl(item.url || item.href);
      if (!href || !/^https:/i.test(href) || !isGitHub(href)) return;
      items.push({ href: href, label: str(item.label || item.name) || 'GitHub' });
    });
    if (!items.length) return; // 静的な GitHub リンクを維持

    listEl.textContent = '';
    items.forEach(function (it) {
      var li = el('li');
      var a = el('a', 'contact-link');
      a.href = it.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer me';
      a.appendChild(el('span', 'contact-link__label', it.label));
      var u = new URL(it.href);
      a.appendChild(el('span', 'contact-link__url', u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')));
      var arrow = el('span', 'contact-link__arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      a.appendChild(arrow);
      a.appendChild(el('span', 'visually-hidden', '（新しいタブで開きます）'));
      li.appendChild(a);
      listEl.appendChild(li);
    });
  }

  (function loadProjects() {
    if (!window.fetch) return;
    fetch('./data/projects.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var raw = Array.isArray(data) ? data : (data && (data.projects || data.items || data.works));
        if (!Array.isArray(raw)) throw new Error('Unexpected format');
        renderProjects(raw.map(normalizeProject).filter(Boolean));
        renderContact(data);
      })
      .catch(function (err) {
        // 静的 HTML の内容をそのまま表示し続ける
        if (window.console) console.warn('[xero] projects.json を読み込めませんでした:', err && err.message);
      });
  })();

  /* ---------------------------------------------------------
     Misc
     --------------------------------------------------------- */
  var yearNode = $('[data-year]');
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());
})();

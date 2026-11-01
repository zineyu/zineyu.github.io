/* 站点交互：主题切换、站内搜索、评论懒加载。无第三方依赖。 */
(() => {
  "use strict";

  /* ============================================================
     主题：auto / light / dark，存 localStorage
     ============================================================ */

  const STORAGE_KEY = "theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const THEMES = ["auto", "light", "dark"];

  function isDarkTheme(theme) {
    return theme === "dark" || (theme === "auto" && media.matches);
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    syncGiscusTheme(isDarkTheme(theme) ? "dark" : "light");
  }

  let theme = "auto";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) theme = stored;
  } catch (_) {}
  applyTheme(theme);

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (_) {}
      applyTheme(theme);
    });
  }

  media.addEventListener("change", () => {
    if (theme === "auto") applyTheme("auto");
  });

  /* ============================================================
     站内搜索：Zola 生成 search_index.<lang>.json，这里做 bigram 检索
     ============================================================ */

  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/;
  const WORD = /[a-z0-9_-]/;
  const MAX_RESULTS = 8;

  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  const statusEl = document.getElementById("search-status");
  const resultsEl = document.getElementById("search-results");

  const indexState = { docs: null, loading: false, failed: false };
  let results = [];
  let active = 0;
  let debounceTimer = 0;

  function tokenize(text) {
    const tokens = [];
    let cjk = "";
    let word = "";

    const flushCjk = () => {
      if (cjk.length === 1) tokens.push(cjk);
      for (let i = 0; i + 1 < cjk.length; i += 1) tokens.push(cjk.slice(i, i + 2));
      cjk = "";
    };
    const flushWord = () => {
      if (word) tokens.push(word);
      word = "";
    };

    for (const ch of text.toLowerCase()) {
      if (CJK.test(ch)) {
        flushWord();
        cjk += ch;
      } else if (WORD.test(ch)) {
        flushCjk();
        word += ch;
      } else {
        flushCjk();
        flushWord();
      }
    }
    flushCjk();
    flushWord();
    return tokens;
  }

  async function ensureIndex() {
    if (indexState.docs) return indexState.docs;
    if (indexState.loading) return null;
    if (indexState.failed) return null;

    indexState.loading = true;
    try {
      const url = document.body.dataset.searchIndex;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      indexState.docs = raw.map((doc) => ({
        url: doc.url,
        title: doc.title || "",
        description: doc.description || "",
        body: doc.body || "",
        haystack: [doc.title, doc.description, doc.body]
          .filter(Boolean)
          .join("\n")
          .toLowerCase(),
      }));
    } catch (error) {
      indexState.failed = true;
      setStatus("搜索索引加载失败，请刷新重试。");
    } finally {
      indexState.loading = false;
    }
    return indexState.docs;
  }

  function scoreDoc(doc, tokens) {
    const title = doc.title.toLowerCase();
    const description = doc.description.toLowerCase();
    let total = 0;

    for (const token of tokens) {
      let score = 0;
      if (title.includes(token)) score += 6;
      if (description.includes(token)) score += 2;
      if (doc.haystack.includes(token)) score += 1;
      if (score === 0) return 0; // 任一 token 未命中即淘汰，保证结果相关
      total += score;
    }
    return total;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function makeSnippet(doc, tokens) {
    const source = doc.body || doc.description || "";
    if (!source) return "";
    const lower = source.toLowerCase();
    const hits = tokens
      .map((token) => lower.indexOf(token))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    const hit = hits.length ? hits[0] : 0;
    let start = Math.max(0, hit - 30);
    // 不要把词切一半：从前一段的边界开始
    if (start > 0) {
      const boundary = source.slice(start, start + 12).search(/[\s，。、；：！？,.;:!?）)」』]/);
      if (boundary > 0) start += boundary + 1;
    }
    const end = Math.min(source.length, start + 110);
    let text = source.slice(start, end);
    if (start > 0) text = `…${text}`;
    if (end < source.length) text = `${text}…`;

    let html = escapeHtml(text);
    const unique = [...new Set(tokens)].sort((a, b) => b.length - a.length);
    for (const token of unique) {
      const safe = escapeHtml(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(safe, "gi"), (match) => `<mark>${match}</mark>`);
    }
    return html;
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || "";
  }

  function renderResults() {
    if (!resultsEl) return;
    resultsEl.innerHTML = "";

    results.forEach((doc, index) => {
      const li = document.createElement("li");
      li.className = "search-result";
      if (index === active) li.classList.add("is-active");

      const link = document.createElement("a");
      link.href = doc.url;

      const title = document.createElement("span");
      title.className = "search-result-title";
      title.textContent = doc.title || doc.url;
      link.appendChild(title);

      const snippet = makeSnippet(doc, tokenize(input.value));
      if (snippet) {
        const span = document.createElement("span");
        span.className = "search-result-snippet";
        span.innerHTML = snippet;
        link.appendChild(span);
      }

      li.appendChild(link);
      resultsEl.appendChild(li);
    });
  }

  function search(query) {
    const tokens = tokenize(query.trim());
    if (!tokens.length || !indexState.docs) {
      results = [];
      renderResults();
      return;
    }

    results = indexState.docs
      .map((doc) => ({ doc, score: scoreDoc(doc, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.doc);

    active = 0;
    renderResults();
    setStatus(results.length ? `找到 ${results.length} 篇` : "没有匹配的文章");
  }

  function openSearch() {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (input) {
      input.value = "";
      input.focus();
    }
    setStatus("输入关键词开始搜索");
    results = [];
    renderResults();
    ensureIndex().then((docs) => {
      if (docs) setStatus("输入关键词开始搜索");
    });
  }

  function closeSearch() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  const searchOpen = document.getElementById("search-open");
  const searchClose = document.getElementById("search-close");
  if (searchOpen) searchOpen.addEventListener("click", openSearch);
  if (searchClose) searchClose.addEventListener("click", closeSearch);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeSearch();
    });
  }

  if (input) {
    input.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => search(input.value), 120);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!results.length) return;
        event.preventDefault();
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
        renderResults();
        resultsEl?.children[active]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        const target = results[active];
        if (target) window.location.href = target.url;
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    const key = event.key;

    if (key === "Escape" && modal && !modal.hidden) {
      closeSearch();
    } else if (event.altKey && (key === "t" || key === "T")) {
      event.preventDefault();
      themeToggle?.click();
    } else if (event.altKey && key === "/") {
      event.preventDefault();
      openSearch();
    } else if ((key === "k" || key === "K") && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      openSearch();
    } else if (key === "/" && !typing) {
      event.preventDefault();
      openSearch();
    }
  });

  /* ============================================================
     评论：giscus 进入视口才加载，主题跟随站点
     ============================================================ */

  function syncGiscusTheme(mode) {
    const frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: mode } } },
      "https://giscus.app"
    );
  }

  function loadGiscus(container) {
    if (container.dataset.loaded) return;
    container.dataset.loaded = "1";

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";

    const attributes = {
      "data-repo": container.dataset.repo,
      "data-repo-id": container.dataset.repoId,
      "data-category": container.dataset.category,
      "data-category-id": container.dataset.categoryId,
      "data-mapping": container.dataset.mapping || "pathname",
      "data-lang": container.dataset.lang || "zh-CN",
      "data-theme": isDarkTheme(theme) ? "dark" : "light",
      "data-reactions-enabled": "1",
      "data-emit-metadata": "0",
      "data-input-position": "top",
      "data-loading": "lazy",
    };

    for (const [key, value] of Object.entries(attributes)) {
      if (value) script.setAttribute(key, value);
    }

    container.innerHTML = "";
    container.appendChild(script);
  }

  const giscus = document.querySelector(".giscus[data-repo]");
  if (giscus) {
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              loadGiscus(entry.target);
              observer.disconnect();
            }
          }
        },
        { rootMargin: "400px" }
      );
      observer.observe(giscus);
    } else {
      loadGiscus(giscus);
    }
  }
})();

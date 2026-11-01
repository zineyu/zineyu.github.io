# homepage —— 开发约定

个人主页 + 博客的纯静态站点。仓库根 `AGENTS.md` 的通用规范同样适用。

## 硬约束

- **Zola 版本固定为 `v0.23.6`**（`devenv.nix` 与 `.github/workflows/deploy.yml` 两处，改版本要同时改）。本地用 `devenv shell`，不要用系统里其它版本的 zola。
- **不引入前端依赖**：没有 Node、没有 npm、没有打包器。样式写在 `static/css/style.css`，脚本写在 `static/js/site.js`。加第三方 JS 前先说明理由。
- **视觉基准**：中性灰阶 + 白色卡片 + 无强调色（参考 PaperMod）。颜色全部走 `:root` 里的 `light-dark()` 变量，不要在组件里写死色值；尺寸走 `--gap` / `--main-width` / `--radius`。
- **Tera 2 语法**（Zola 0.23 起）：
  - macro 已移除（没有 `{% macro %}` / `{% import %}` / `self::`）；
  - `slice` 过滤器已移除，用切片 `pages[:5]`；
  - 访问可能不存在的字段用可选链 `page.taxonomies?["tags"] or []`，直接访问会报错。
- 正文也是 Tera 模板：Markdown 里出现 `{{ }}` / `{% %}` 必须包在 `{% raw %}…{% endraw %}` 中。
- 站内链接一律用 `@/blog/foo.md` 形式，让 `zola check` 能校验。

## 结构约定

- `content/` 只放内容和资源；`templates/` 一个模板一件事；`partials/` 放被 include 的片段。
- 站点可调参数集中在 `zola.toml`（含 `[extra]`），不要在模板里硬编码名字、域名、社交链接。
- 代码高亮是单主题（`github-dark`，class 模式，输出 `giallo.css`），代码块在所有配色下都是暗色，不要改回双主题除非同步改 `head.html`。
- 文章 frontmatter 必需 `title`、`description`、`date`；`<!-- more -->` 之前是摘要。

## 提交前

```bash
just ci        # zola check + zola build，必须全绿
```

- 用 `jj` 管理改动，commit 保持原子化（中文标题，可带 `feat:` / `fix:` / `docs:` 前缀）。
- `public/` 是构建产物，不提交。

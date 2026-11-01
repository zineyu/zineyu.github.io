# zineyu 的个人主页与博客

纯静态站点：Markdown 写内容，[Zola](https://www.getzola.org/)（Rust 单二进制）在构建时渲染成 HTML，托管在 GitHub Pages。

没有数据库、没有后端、没有 Node 构建链、没有 npm 依赖。

## 技术栈

| 关注点 | 方案 | 说明 |
| --- | --- | --- |
| 生成器 | Zola `v0.23.6` | 版本在 `devenv.nix` 与 CI 中同时锁定 |
| 模板 | Tera 2（Zola 内置） | 注意：Tera 2 已移除 macro，语法与旧教程不同 |
| 样式 | 手写 CSS（`static/css/style.css`） | 单文件；设计语言参考 PaperMod：中性灰阶、白卡片、无强调色 |
| 高亮 | Giallo 单主题（`github-dark`，class 模式） | 构建产物 `giallo.css`，代码块始终为暗色 |
| 搜索 | Zola 生成 JSON 索引 + 自写 bigram 检索 | `static/js/site.js`，中文友好 |
| 评论 | giscus（GitHub Discussions） | 进入视口才加载，主题跟随站点 |
| 环境 | `devenv.nix`（zola + just + git + jj） | 与 `byte/`、`shell/` 等仓库一致 |
| 部署 | GitHub Actions → GitHub Pages | 官方 `getzola/github-pages` action |

## 快速开始

```bash
devenv shell          # 进入环境（zola / just / git / jj）
just serve            # 本地预览 http://127.0.0.1:1111，含草稿、热重载
just build            # 构建到 public/
just check            # 检查内部链接与锚点
just ci               # check + build，等价于 CI 行为
```

没有 devenv 时，任意方式装到 Zola 0.23.6 即可：

```bash
nix shell nixpkgs#zola -c zola serve
```

## 目录结构

```
zola.toml                 # 站点配置：域名、标题、社交链接、giscus、搜索
content/
  _index.md               # 首页（模板 templates/index.html）
  about.md                # 关于页
  blog/
    _index.md             # 博客列表（分页、排序）
    *.md                  # 文章
templates/
  base.html               # 页面骨架（列表页 / 单页两种 body class）
  index.html              # 首页：简介卡片 + 最新文章卡片
  section.html            # 列表页（博客、分页）
  page.html               # 文章页：面包屑、目录、标签、上下篇、评论
  taxonomy_list.html      # /tags/
  taxonomy_single.html    # /tags/<tag>/
  404.html  anchor-link.html
  partials/               # head / header / footer / 文章列表 / 分页 / 搜索框 / 评论
static/
  css/style.css           # 全部样式
  js/site.js              # 主题切换 + 站内搜索 + 评论懒加载
  favicon.svg
.github/workflows/deploy.yml
```

## 写文章

```bash
just new my-post-title    # 生成 content/blog/<日期>-my-post-title.md
```

或者手写一个文件：

```markdown
+++
title = "文章标题"
description = "一句话摘要，会出现在列表、搜索结果和 meta description 里。"
date = 2026-11-02
[taxonomies]
tags = ["Rust", "工程实践"]
+++

开头这一段会作为摘要（`page.summary`）。

<!-- more -->

正文从这里开始。
```

约定：

- `date` 必填，列表按日期倒序；未来日期的文章不会出现在构建产物里（除非 `zola serve --drafts` 且标记 `draft = true`）。
- `<!-- more -->` 之前的内容是摘要，建议写 1–2 句。
- 标签直接用中文，URL 会保留中文（`[slugify] taxonomies = "safe"`）。
- 文章里的站内链接用 `@/blog/other-post.md` 写法，构建时会校验，改文件名不会留下死链。
- 内容会被当作 Tera 模板渲染：正文里要写 `{{ }}` / `{% %}` 时用 `{% raw %}…{% endraw %}` 包起来。

## 需要改的配置

大部分在 `zola.toml`：

1. **`base_url`**（唯一必填项，结尾必须带斜杠）
   - 用户主页仓库 `zineyu.github.io` → `https://zineyu.github.io/`
   - 项目仓库 `homepage` → `https://zineyu.github.io/homepage/`
   - 自定义域名 → `https://example.com/`
2. **站点标题 / 简介 / 作者**：`title`、`description`、`author`。
3. **首页文案**：标题在 `zola.toml` 的 `[extra] home_title`，正文在 `content/_index.md`。
4. **社交链接**：`[[extra.social]]`（`name` 决定图标，支持 `github` / `email` / `x`；RSS 图标固定渲染）。
5. **评论**：见下一节。

## 评论（giscus）

默认不渲染，填好 ID 才生效：

1. 仓库要 public，并在 **Settings → General → Features** 勾选 **Discussions**。
2. 安装 [giscus app](https://github.com/apps/giscus) 到该仓库。
3. 打开 <https://giscus.app>，填仓库名，选择 `Announcements` 分类和 `pathname` 映射，复制生成的 `data-repo-id` 与 `data-category-id`。
4. 写入 `zola.toml`：

```toml
[extra.giscus]
repo = "zineyu/zineyu.github.io"
repo_id = "R_kgDO..."
category = "Announcements"
category_id = "DIC_kwDO..."
mapping = "pathname"
```

评论只在带 `date` 的页面（即博客文章）出现，且滚动到附近才加载脚本。

## 部署

首次配置：

1. 在 GitHub 新建仓库并推送（分支 `main`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
3. 推送到 `main` 即触发 `.github/workflows/deploy.yml`：官方 action 用固定版本 Zola 镜像构建、跑 `zola check`、上传 artifact，再由 `actions/deploy-pages` 发布。

改域名只需改 `zola.toml` 的 `base_url`，CI 不用动。

## 实现说明

- **主题**：`prefers-color-scheme` + 手动三态（跟随系统 / 亮 / 暗），存 `localStorage`；配色用 CSS `light-dark()`，切换只改 `color-scheme`。列表页浅灰底 + 白色卡片，单页白底，和 PaperMod 一致。
- **布局**：`--main-width: 720px`、`--nav-width: 1024px`、`--gap: 24px`，正文 18px / 行高 1.6；改这几个变量就能调整整体密度。
- **搜索**：构建期 Zola 输出 `public/search_index.zh.json`（`index_format = "fuse_json"`）；运行时中文按 bigram、英文按词切分，标题权重 6 / 描述 2 / 正文 1，任一 token 未命中即淘汰。按 `/` 或 `Ctrl+K` 打开。
- **无 npm**：没有 Tailwind、没有打包器、没有第三方 JS。`static/js/site.js` 是唯一的脚本。

## 常见问题

**改完模板本地正常、CI 报 Tera 错误？**
检查是否用了 Tera 1 的写法。Tera 2 移除了 macro，`slice` 过滤器改成了切片语法（`pages[:5]`），访问可能不存在的字段要用可选链（`page.taxonomies?["tags"]`）。

**代码块语言写错导致构建失败？**
`[markdown.highlighting] error_on_missing_language = true`，把语言标识写对，或改成 `false`。

**`zola check` 报外链错误？**
外链只报警告（`external_level = "warn"`），不影响 CI；确需屏蔽可加到 `[link_checker] skip_prefixes`。

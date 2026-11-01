+++
title = "为什么这个站点是静态的"
description = "个人主页和博客需要什么、不需要什么，以及为什么我最终选了 Zola 这一个 Rust 二进制。"
date = 2026-11-02
[taxonomies]
tags = ["建站", "Rust", "工程实践"]
+++

个人主页 + 博客是一个非常小的产品：几十到几百篇文章，读多写少，内容几乎不变。为它引入数据库、后端服务、Node 构建链，收益接近于零，成本却是长期的——依赖会过期，构建会坏，证书会忘。

所以这个站点的全部工具链是：

| 关注点 | 方案 | 依赖 |
| --- | --- | --- |
| 内容 | Markdown + TOML frontmatter | 无 |
| 渲染 | Zola（Rust 单二进制） | 一个二进制 |
| 样式 | 手写 CSS | 无 |
| 搜索 | 构建期生成 JSON 索引 + 几十行 JS | 无 |
| 评论 | giscus（GitHub Discussions） | 无服务端 |
| 部署 | GitHub Actions → GitHub Pages | 无服务器 |

<!-- more -->

## 静态站点真正省掉的是什么

省掉的不是「服务器」，而是**需要持续照看的东西**：

- 不需要升级运行时、打补丁、盯着证书到期。
- 不需要为「首页会不会慢」做容量规划——它就是几个静态文件。
- 不需要维护缓存失效逻辑，CDN 直接吃 HTML。
- 构建是可复现的：同一个 commit + 同一个 Zola 版本 = 同样的产物。

代价是：动态能力要靠外部服务（评论交给 giscus，搜索在浏览器里做）。对这个规模的站点，这个交换非常划算。

## 为什么是 Zola，而不是自己写一个生成器

用 Rust 写一个「读 Markdown → 套模板 → 输出 HTML」的生成器，一天能跑通，但接下来要处理的是：内部链接解析、标签页、分页、RSS、sitemap、代码高亮、锚点、链接检查、增量构建……这些都不是有趣的部分，却是博客必须正确的部分。

Zola 已经把这些做完了，而且是单一二进制、零运行时依赖：

```bash
zola build     # 输出 public/
zola serve     # 本地预览 + 热重载
zola check     # 检查内部链接和锚点
```

它的模板语言是 Tera，模板里能直接拿到结构化数据：

{% raw %}
```jinja
{% set blog = get_section(path="blog/_index.md") %}
{% for page in blog.pages %}
  <a href="{{ page.permalink }}">{{ page.title }}</a>
{% endfor %}
```
{% endraw %}

## 版本固定：devenv 里锁一个二进制

```nix
packages = [ pkgs.zola pkgs.just ];
```

本地 `devenv shell` 拿到的 Zola 版本，和 CI 里 docker 镜像的版本是同一个 pin。这样「本地能构建、CI 挂掉」这类问题从源头消失。

## 一个具体的取舍：搜索

Zola 可以生成 elasticlunr 或 fuse 格式的索引，但它们的默认分词对中文不友好——一整段中文会被当成一个 token，搜「搜索」搜不到「客户端搜索」。

所以这里只用了 Zola 的 `fuse_json` 索引格式作为数据源，查询逻辑自己写：中文按 bigram 切分，英文按词切分，标题命中加权。全部逻辑在 `static/js/search.js` 里，没有第三方库。细节写在[另一篇](@/blog/client-side-search.md)里。

## 小结

> [!TIP]
> 选型的判断标准不是「哪个更强」，而是「哪个需要我长期照看的东西最少」。

对一个个人站点来说，答案通常是：静态生成 + 静态托管 + 把动态能力外包给平台。

+++
title = "中文客户端搜索：不用库，四十行 JS"
description = "Zola 生成的索引 + bigram 分词，在浏览器里实现一个对中文友好的站内搜索。"
date = 2026-10-28
[taxonomies]
tags = ["搜索", "前端", "建站"]
+++

静态站点做搜索有两个选择：交给第三方（Algolia 之类），或者把索引在构建期生成、在浏览器里查。前者要账号、要额度、要联网可用性；后者只是一个 JSON 文件加一段 JS。

这个站点选了后者。全文大约 40 行，没有第三方库。

<!-- more -->

## 索引从哪来

`zola.toml` 里打开：

```toml
build_search_index = true

[search]
index_format = "fuse_json"
include_title = true
include_description = true
include_content = true
truncate_content_length = 4000
```

构建后得到 `public/search_index.zh.json`，是一个数组：

```json
[
  {
    "url": "https://example.com/blog/hello-zola/",
    "title": "为什么这个站点是静态的",
    "description": "个人主页和博客需要什么……",
    "body": "个人主页 + 博客是一个非常小的产品……"
  }
]
```

Zola 在生成前会用 ammonia 把 HTML 洗成纯文本，所以 `body` 直接可以搜，不需要再处理标签。

## 为什么不能直接用 Fuse.js

Fuse.js 的默认分词按空白和标点切。中文句子没有空格，于是「中文客户端搜索」整句变成一个 token，用户搜「搜索」时匹配不到任何东西。

解决办法不是换库，而是换分词方式：**中文按相邻两字切分（bigram）**。

- 查询「客户端搜索」→ `客户` `户端` `端搜` `搜索`
- 文档里包含「客户端搜索」→ 同样切出这四个 bigram
- 命中数即得分

bigram 的召回率高于单字（「搜索」不会命中「搜罗」），又不需要词典和分词模型。对几万字的个人博客来说完全够用。

## 实现

索引只加载一次，之后每次查询都在内存里算：

```js
let docs = null;

async function loadIndex() {
  if (docs) return docs;
  const res = await fetch(document.body.dataset.searchIndex);
  docs = (await res.json()).map((d) => ({
    ...d,
    haystack: `${d.title ?? ""}\n${d.description ?? ""}\n${d.body ?? ""}`.toLowerCase(),
  }));
  return docs;
}
```

切词：连续的中日韩字符切成 bigram，拉丁字母和数字按词切。

```js
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/;

function tokenize(text) {
  const tokens = [];
  let cjk = "";
  let word = "";

  const flushCjk = () => {
    if (cjk.length === 1) tokens.push(cjk);
    for (let i = 0; i + 1 < cjk.length; i++) tokens.push(cjk.slice(i, i + 2));
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
    } else if (/[a-z0-9_-]/.test(ch)) {
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
```

打分时标题权重最高，其次描述，正文最低：

```js
function score(doc, tokens) {
  const title = (doc.title ?? "").toLowerCase();
  const desc = (doc.description ?? "").toLowerCase();
  let total = 0;

  for (const t of tokens) {
    let s = 0;
    if (title.includes(t)) s += 6;
    if (desc.includes(t)) s += 2;
    if (doc.haystack.includes(t)) s += 1;
    if (s === 0) return 0; // 任一 token 未命中，视为不相关
    total += s;
  }
  return total;
}
```

「任一 token 未命中就淘汰」是关键：这样「客户端搜索」不会因为只命中「客户端」而排在前面，结果精度明显好于简单的 OR 匹配。

## 结果展示

命中位置附近截一段文本作为摘要，命中的词用 `<mark>` 高亮：

```js
function snippet(doc, tokens) {
  const body = doc.body ?? doc.description ?? "";
  const lower = body.toLowerCase();
  const hit = tokens.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 40);
  return (start > 0 ? "…" : "") + body.slice(start, start + 120) + (start + 120 < body.length ? "…" : "");
}
```

## 这个方案的上限

- 索引随文章数量线性增长。整站正文进索引，一万字大约几十 KB，压缩后更小；真到几 MB 就该改成只索引标题 + 描述。
- 没有相关度模型，只有词频和字段权重。对博客足够，对文档站不够。
- 首次搜索要下载索引。用 `IntersectionObserver` 或首次聚焦输入框时再 `fetch`，别在首屏加载。

## 小结

静态站点的搜索不需要服务：**构建期算数据，运行期算查询**。中文的分词问题也不是必须上库，bigram 这个 30 行的近似方案，在个人博客的规模上比引入一个搜索库更划算。

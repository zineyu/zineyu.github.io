# 常用任务：just <recipe>；不带参数默认本地预览
default: serve

# 本地预览（含草稿），热重载
serve:
    zola serve --drafts

# 构建到 public/
build:
    zola build

# 检查内部链接、锚点与外部链接
check:
    zola check

# 构建前先检查，等价于 CI 的行为
ci: check build

# 新建一篇文章：just new my-post-title
new slug:
    #!/usr/bin/env bash
    set -euo pipefail
    file="content/blog/$(date +%Y-%m-%d)-{{ slug }}.md"
    if [ -e "$file" ]; then
        echo "已存在: $file" >&2
        exit 1
    fi
    cat > "$file" <<EOF
    +++
    title = ""
    description = ""
    date = $(date +%Y-%m-%d)
    [taxonomies]
    tags = []
    +++

    <!-- more -->
    EOF
    echo "已创建: $file"

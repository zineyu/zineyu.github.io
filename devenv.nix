{ pkgs, ... }:

{
  # 站点构建只需要 Zola 一个二进制；不需要 Node / npm / 前端构建管线。
  packages = [
    pkgs.zola
    pkgs.just
    pkgs.git
    pkgs.jujutsu
  ];

  enterShell = ''
    echo "zola $(zola --version | cut -d' ' -f2)  ·  just $(just --version | cut -d' ' -f2)"
    echo "本地预览: just serve    构建: just build    检查链接: just check"
  '';
}

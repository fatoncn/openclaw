#!/bin/bash
# OpenClaw Kosbling Edition — 构建并注册全局 CLI
# 
# 开发机：在 fork 源码目录运行
# 目标机器：git clone 到 ~/.openclaw-kosbling 后运行
#
# 首次安装（目标机器）：
#   git clone git@github.com:fatoncn/openclaw.git ~/.openclaw-kosbling
#   cd ~/.openclaw-kosbling && ./build-and-link.sh
#
# 后续更新（目标机器）：
#   cd ~/.openclaw-kosbling && git pull && ./build-and-link.sh
#
set -e

cd "$(dirname "$0")"

# 从 git tag 注入版本号到 package.json
GIT_VERSION=$(git describe --tags --match 'v*-kosbling.*' 2>/dev/null | sed 's/^v//')
if [ -z "$GIT_VERSION" ]; then
  # 没有 kosbling tag，用最近的任意 tag
  GIT_VERSION=$(git describe --tags 2>/dev/null | sed 's/^v//')
fi
if [ -n "$GIT_VERSION" ]; then
  echo "📌 Version from git: $GIT_VERSION"
  node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version='$GIT_VERSION'; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
fi

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "🔨 Building..."
pnpm build
pnpm ui:build

# 卸载官方 openclaw（如果存在且不是当前目录的 link）
CURRENT_LINK=$(npm ls -g openclaw --parseable 2>/dev/null || true)
if [ -n "$CURRENT_LINK" ] && [ "$(realpath "$CURRENT_LINK" 2>/dev/null)" != "$(realpath "$(pwd)" 2>/dev/null)" ]; then
  echo "🗑️  Removing existing openclaw global install..."
  npm uninstall -g openclaw 2>/dev/null || true
fi

echo "🔗 Linking to global CLI..."
npm link

echo ""
echo "✅ OpenClaw Kosbling Edition ready!"
echo "   Source: $(pwd)"
echo "   CLI:    $(which openclaw)"
echo "   Version: $(openclaw --version 2>/dev/null || echo 'unknown')"

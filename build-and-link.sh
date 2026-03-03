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

# 读取版本并做一致性检查（不再修改 package.json，避免工作区脏改动）
if [ -f "VERSION" ]; then
  APP_VERSION=$(tr -d '[:space:]' < VERSION)
  PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
  echo "📌 Version (VERSION): ${APP_VERSION}"
  echo "📌 Version (package.json): ${PKG_VERSION:-unknown}"
  if [ -n "$PKG_VERSION" ] && [ "$APP_VERSION" != "$PKG_VERSION" ]; then
    echo "⚠️  VERSION and package.json version differ."
    echo "   Build output will use VERSION (via scripts/write-build-info.ts)."
    echo "   Keep package.json aligned only when you need release metadata consistency."
  fi
else
  echo "⚠️  VERSION file not found"
fi

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "🔨 Building..."
pnpm build
pnpm ui:build

# 只有运行仓库（~/.openclaw-kosbling）才执行 link
# 开发仓库只 build，不抢全局 CLI
RUNTIME_REPO="$HOME/.openclaw-kosbling"
CURRENT_DIR="$(realpath "$(pwd)")"

if [ "$CURRENT_DIR" = "$(realpath "$RUNTIME_REPO" 2>/dev/null)" ]; then
  # 卸载旧的 + link
  CURRENT_LINK=$(npm ls -g openclaw --parseable 2>/dev/null || true)
  if [ -n "$CURRENT_LINK" ] && [ "$(realpath "$CURRENT_LINK" 2>/dev/null)" != "$CURRENT_DIR" ]; then
    echo "🗑️  Removing existing openclaw global install..."
    npm uninstall -g openclaw 2>/dev/null || true
  fi

  echo "🔗 Linking to global CLI..."
  npm link

  # 重启 gateway（restart = stop + install + start，避免 service 被卸载后 start 失败）
  echo "🚀 Restarting gateway..."
  openclaw gateway restart 2>&1 || {
    echo "   restart failed, trying install + start..."
    openclaw gateway install 2>&1 || true
    openclaw gateway start 2>&1 || true
  }
  sleep 3
  if openclaw gateway status 2>/dev/null | grep -q "running"; then
    echo "   ✅ Gateway running"
  else
    echo "   ⚠️  Gateway may not have started, check: openclaw gateway status"
  fi

  echo ""
  echo "✅ OpenClaw Kosbling Edition ready!"
  echo "   Source: $(pwd)"
  echo "   CLI:    $(which openclaw)"
  echo "   Version: $(openclaw --version 2>/dev/null || echo 'unknown')"
else
  echo ""
  echo "✅ Build complete (dev repo — no global link)"
  echo "   Source: $(pwd)"
  echo "   ℹ️  To deploy, push to git then run build-and-link.sh in $RUNTIME_REPO"
fi

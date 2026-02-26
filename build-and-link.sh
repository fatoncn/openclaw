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

# 从 VERSION 文件读取版本号注入 package.json
if [ -f "VERSION" ]; then
  APP_VERSION=$(cat VERSION | tr -d '[:space:]')
  echo "📌 Version: $APP_VERSION"
  node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version='$APP_VERSION'; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
else
  echo "⚠️  VERSION file not found, using package.json version as-is"
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
  # 运行仓库：先停 gateway
  echo "🛑 Stopping gateway before link..."
  if openclaw gateway status 2>/dev/null | grep -q "running"; then
    echo "   Gateway is running, stopping..."
    openclaw gateway stop 2>&1 || true
    # 等待进程退出
    sleep 2
    if lsof -i :18789 -t >/dev/null 2>&1; then
      echo "   ⚠️  Port 18789 still in use, waiting..."
      sleep 3
    fi
    echo "   ✅ Gateway stopped"
  else
    echo "   Gateway not running, skipping stop"
  fi

  # 卸载旧的 + link
  CURRENT_LINK=$(npm ls -g openclaw --parseable 2>/dev/null || true)
  if [ -n "$CURRENT_LINK" ] && [ "$(realpath "$CURRENT_LINK" 2>/dev/null)" != "$CURRENT_DIR" ]; then
    echo "🗑️  Removing existing openclaw global install..."
    npm uninstall -g openclaw 2>/dev/null || true
  fi

  echo "🔗 Linking to global CLI..."
  npm link

  # 重启 gateway
  echo "🚀 Starting gateway..."
  openclaw gateway start 2>&1 || true
  sleep 2
  if openclaw gateway status 2>/dev/null | grep -q "running"; then
    echo "   ✅ Gateway started"
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

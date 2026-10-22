#!/usr/bin/env bash
# One-time setup of an Ubuntu/Debian server for local EAS Android builds.
# Run on the server: bash setup-build-server.sh
set -euo pipefail

SDK_DIR="$HOME/android-sdk"
CMDLINE_ZIP="commandlinetools-linux-13114758_latest.zip"

sudo apt-get update
sudo apt-get install -y openjdk-17-jdk unzip git curl tmux rsync

# Node 22 if node is missing or older than 20.
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if [ ! -x "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  mkdir -p "$SDK_DIR/cmdline-tools"
  curl -fsSL "https://dl.google.com/android/repository/$CMDLINE_ZIP" -o /tmp/cmdline-tools.zip
  unzip -q /tmp/cmdline-tools.zip -d "$SDK_DIR/cmdline-tools"
  mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  rm /tmp/cmdline-tools.zip
fi

export ANDROID_HOME="$SDK_DIR"
export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# `yes` dies of SIGPIPE when sdkmanager exits, which pipefail would treat as failure.
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# Kept in its own file: Ubuntu's .bashrc exits early for non-interactive shells.
cat > "$HOME/.android-env" <<RC
export ANDROID_HOME="$SDK_DIR"
export JAVA_HOME="$JAVA_HOME"
export PATH="\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH"
RC
grep -q "android-env" "$HOME/.bashrc" || echo ". \"\$HOME/.android-env\"" >> "$HOME/.bashrc"

echo
echo "Done. Now run: source ~/.android-env && npx eas-cli@latest login"

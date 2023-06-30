#!/bin/bash
set -euo pipefail

SERVER="https://desmos.com"
CACHE_FOLDER="node_modules/.cache/desmos"
CALC_DESKTOP="$CACHE_FOLDER/calculator_desktop.js"
PREFIX='<script src="/assets/build/calculator_desktop'

if [ ! -f $CALC_DESKTOP ]; then
  echo "Downloading '$SERVER/calculator' calculator_desktop URL"
  build=$(wget -nv -O - "$SERVER/calculator" | grep "$PREFIX" | cut -d\" -f 2)
  js="$SERVER$build"
  echo "Mkdir cache folder"
  mkdir -p "$CACHE_FOLDER"
  echo "Downloading latest calculator_desktop: '$js'"
  wget "$js" -O "$CALC_DESKTOP"
  echo "Download finished"
fi

jest --config jest.config.js "$@"

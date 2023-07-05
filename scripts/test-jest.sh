#!/bin/bash
set -euo pipefail

SERVER="https://desmos.com"
CACHE_FOLDER="node_modules/.cache/desmos"
CALC_DESKTOP="$CACHE_FOLDER/calculator_desktop.js"
PREFIX='<script src="/assets/build/calculator_desktop'

USAGE="Usage: $0 [unit|integration|both]"

if [ "$#" == "0" ]; then
	echo "$USAGE"
	exit 1
fi

mode="$1"
shift

case "$mode" in
  unit)
    CONFIG=unit
    OPTS=""
    ;;
  integration)
    CONFIG=integration
    OPTS="--run-in-band"
    ;;
  both)
    $0 unit "$@"
    $0 integration "$@"
    exit 0
    ;;
  *)
    echo "$USAGE"
    exit 1
esac

echo
echo "Running Jest $mode tests."

CONFIG_FILE="jest-config/jest-$CONFIG.config.js"

echo "Config file: $CONFIG_FILE"

# For some reason, node does not respect the "exports" option. Remove the src
# directory so it does not find (and break on) the TS files.
rm -rf ./node_modules/@puppeteer/browsers/src

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

jest --config "$CONFIG_FILE" "$OPTS" "$@"

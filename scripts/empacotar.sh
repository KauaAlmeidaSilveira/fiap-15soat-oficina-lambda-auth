#!/bin/sh
set -eu
rm -rf dist
mkdir -p dist/pacote
cp -R src package.json package-lock.json dist/pacote/
cd dist/pacote
npm ci --omit=dev --ignore-scripts
zip -qr ../lambda.zip src node_modules package.json
cd ..
rm -rf pacote
ls -lh lambda.zip

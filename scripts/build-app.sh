#!/usr/bin/env bash
# Android uygulaması için web dosyalarını app-www/ klasörüne kopyalar (internetsiz çalışması için cihaza gömülür).
set -euo pipefail
rm -rf app-www && mkdir -p app-www
cp -r public/. app-www/
rm -rf app-www/__ app-www/sw.js
cp src/original-index.html app-www/index.html
echo "app-www hazır"

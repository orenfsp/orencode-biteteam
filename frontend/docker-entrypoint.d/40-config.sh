#!/bin/sh
# Генерируем config.js при старте контейнера — менять адрес API/демо-режим можно без пересборки образа.
set -e
case "${SHOW_DEMO}" in true|1|yes) DEMO=true ;; *) DEMO=false ;; esac
cat > /usr/share/nginx/html/config.js <<JS
window.APP_CONFIG = {
  API_BASE: "${API_BASE}",
  SHOW_DEMO: ${DEMO},
};
JS
echo "config.js: API_BASE=${API_BASE} SHOW_DEMO=${DEMO}"

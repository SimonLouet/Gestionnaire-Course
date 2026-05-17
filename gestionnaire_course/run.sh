#!/usr/bin/with-contenv bashio

bashio::log.info "Démarrage du Gestionnaire de Courses..."

if [ ! -d /data/db ]; then
    bashio::log.info "Première exécution : initialisation des données..."
    mkdir -p /data/db
    cp /app/db-defaults/*.json /data/db/
fi

mkdir -p /config/www
cp /app/public/gestionnaire-menu-card.js /config/www/gestionnaire-menu-card.js
bashio::log.info "Card Lovelace copiée dans /config/www/"

export DATA_PATH=/data

exec node /app/server.js

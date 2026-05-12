#!/usr/bin/with-contenv bashio

bashio::log.info "Démarrage du Gestionnaire de Courses..."

if [ ! -d /data/db ]; then
    bashio::log.info "Première exécution : initialisation des données..."
    mkdir -p /data/db
    cp /app/db-defaults/*.json /data/db/
fi

export DATA_PATH=/data

exec node /app/server.js

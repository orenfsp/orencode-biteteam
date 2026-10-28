FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

# nginx подставит переменные окружения в *.template при старте
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# генерирует config.js из переменных окружения (см. docker-entrypoint.d)
COPY docker-entrypoint.d/40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh

COPY index.html /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js

ENV BACKEND_HOST=backend \
    BACKEND_PORT=8000 \
    API_BASE=/api/v1 \
    SHOW_DEMO=false

EXPOSE 80

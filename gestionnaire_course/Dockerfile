ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache nodejs

WORKDIR /app
COPY server.js .
COPY public/ public/
COPY db/ db-defaults/

COPY run.sh /
RUN chmod a+x /run.sh

CMD ["/run.sh"]

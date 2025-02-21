FROM redpencil/virtuoso:1.2.0

FROM semtech/mu-javascript-template:1.8.0
LABEL maintainer="Niels Vandekeybus <progster@gmail.com>"

RUN apt-get update && apt-get install -y unixodbc unixodbc-dev
COPY --from=0 /usr/local/virtuoso-opensource/lib/virtodbcu_r.so /usr/lib/virtodbcu_r.so

# see https://github.com/mu-semtech/mu-javascript-template for more info

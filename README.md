# graph-dump-service
Service that produces and publishes a dump file of the current state of a configured graph. Mainly for use in app-lblod-harvester. For a more generic service see [delta-producer-dump-file-publisher](https://github.com/lblod/delta-producer-dump-file-publisher).


## installation

```yml
  delta-producer-dump-file-publisher:
    image: lblod/graph-dump-service
    links:
      - database:database
    volumes:
      - ./data/files:/share
      - ./data/db/dumps:/dumps
    environment:
      FILES_GRAPH: "http://mu.semte.ch/graphs/harvesting"
      DCAT_DATASET_GRAPH: "http://mu.semte.ch/graphs/harvesting"
      DATASET_URI: "dataset-uri"
      VIRTUOSO_HOSTNAME: "virtuoso"
      VIRTUOSO_USERNAME: "dba"
      VIRTUOSO_PASSWORD: "dba"
      JOB_OPERATION: "your operation"
      ...
    restart: always
    logging: *default-logging

```

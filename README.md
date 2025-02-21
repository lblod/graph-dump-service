# graph-dump-service
Service that produces and publishes a dump file of the current state of a configured graph. Mainly for use in app-lblod-harvester. Similar to [delta-producer-dump-file-publisher](https://github.com/lblod/delta-producer-dump-file-publisher), but this one connects to virtuoso via an odbc connection and executes a stored procedure for faster dumps.


## installation

```yml
  graph-dumper:
    image: lblod/graph-dump-service
    links:
      - virtuoso:virtuoso
    volumes:
      - ./data/files:/share
      - ./data/db/dumps:/dumps
    environment:
      FILES_GRAPH: "http://mu.semte.ch/graphs/harvesting"
      DCAT_DATASET_GRAPH: "http://mu.semte.ch/graphs/harvesting"
      DATASET_URI: "dataset-uri"
      VIRTUOSO_HOSTNAME: "virtuoso"
      JOB_OPERATION: "your operation"
      ...
    restart: always
    logging: *default-logging

```
## set up delta's
```js
  {
    match: {
      predicate: {
        type: 'uri',
        value: 'http://www.w3.org/ns/adms#status'
      },
      object: {
        type: 'uri',
        value: 'http://redpencil.data.gift/id/concept/JobStatus/scheduled'
      }
    },
    callback: {
      url: 'http://graph-dumper/delta',
      method: 'POST'
    },
    options: {
      resourceFormat: 'v0.0.1',
      gracePeriod: 1000,
      ignoreFromSelf: true,
      sendMatchesOnly: true
    }
  }
```
## creating dumps
Dumps are created when a job is scheduled. You can schedule a job in several ways:

### schedule a job using the provided mu script

```
mu script graph-dumper create-dump <jobs-graph>  <configured-job-operation>
```

### using the job-scheduler
You can schedule a job using the [scheduled-job-controller-service](https://github.com/lblod/scheduled-job-controller-service).

Create a migration similar to the following to set up a schedule.
```sparql
INSERT DATA
{
  GRAPH <http://mu.semte.ch/graphs/harvesting> 
  {
 	<http://redpencil.data.gift/id/scheduled-job/c2ffa700-e462-46b4-abf5-103d1a1854d0> a <http://vocab.deri.ie/cogs#ScheduledJob>;
	<http://purl.org/dc/terms/created> "2024-01-26T15:06:01.294Z";
	<http://purl.org/dc/terms/modified> "2024-01-26T15:06:01.294Z";
	<http://redpencil.data.gift/vocabularies/tasks/operation> <your-configured-operation>;
	<http://redpencil.data.gift/vocabularies/tasks/schedule> <http://redpencil.data.gift/id/cron-schedule/daea6070-935e-4df8-9de8-724321ad881a>;
	<http://mu.semte.ch/vocabularies/core/uuid> "c2ffa700-e462-46b4-abf5-103d1a1854d0";
	<http://purl.org/dc/terms/creator> <http://lblod.data.gift/services/of-your-choice>;
	<http://purl.org/dc/terms/title> "Dump files".


	<http://redpencil.data.gift/id/cron-schedule/daea6070-935e-4df8-9de8-724321ad881a> a <http://redpencil.data.gift/vocabularies/tasks/CronSchedule>;
	<http://schema.org/repeatFrequency>  "0 2 * * *";
	<http://mu.semte.ch/vocabularies/core/uuid> "daea6070-935e-4df8-9de8-724321ad881a".
	
	
	
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://redpencil.data.gift/vocabularies/tasks/ScheduledTask> .
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://mu.semte.ch/vocabularies/core/uuid> "c2de4099-e97d-452a-a22c-dee4475715be" .
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://purl.org/dc/terms/created> "2024-01-26T15:06:01.265Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://purl.org/dc/terms/modified> "2024-01-26T15:06:01.265Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://redpencil.data.gift/id/jobs/concept/TaskOperation/deltas/deltaDumpFileCreation> .
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://redpencil.data.gift/vocabularies/tasks/index> "0"^^<http://www.w3.org/2001/XMLSchema#integer>.
<http://redpencil.data.gift/id/scheduled-task/c2de4099-e97d-452a-a22c-dee4475715be> <http://purl.org/dc/terms/isPartOf> <http://redpencil.data.gift/id/scheduled-job/c2ffa700-e462-46b4-abf5-103d1a1854d0> .

  }
}
```

### using [delta-producer-background-jobs-initiator](https://github.com/lblod/delta-producer-background-jobs-initiator)

This is currently not well tested, but the graph dump service should be able to replace the [dump-file-publisher](https://github.com/lblod/delta-producer-dump-file-publisher/) and be scheduled by the delta-producer-background-jobs-iniator

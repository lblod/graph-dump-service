#!/bin/sh
ENDPOINT="http://database:8890/sparql"
JOB_UUID=$(cat /proc/sys/kernel/random/uuid)
TASK_UUID=$(cat /proc/sys/kernel/random/uuid)
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
GRAPH=$1
JOB_OPERATION=$2
SPARQL_UPDATE="""
PREFIX adms: <http://www.w3.org/ns/adms#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

INSERT DATA {
    GRAPH <$GRAPH> {
    <http://redpencil.data.gift/id/job/$JOB_UUID> mu:uuid \"$JOB_UUID\".
    <http://redpencil.data.gift/id/job/$JOB_UUID> <http://redpencil.data.gift/vocabularies/tasks/operation> <$JOB_OPERATION>.
    <http://redpencil.data.gift/id/job/$JOB_UUID> a <http://vocab.deri.ie/cogs#Job>.
    <http://redpencil.data.gift/id/job/$JOB_UUID> adms:status <http://redpencil.data.gift/id/concept/JobStatus/scheduled>.
    <http://redpencil.data.gift/id/job/$JOB_UUID> dct:created \"$CURRENT_TIME\"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
    <http://redpencil.data.gift/id/job/$JOB_UUID> dct:creator <http://lblod.data.gift/services/graph-dump-service>.
    <http://redpencil.data.gift/id/job/$JOB_UUID> dct:modified \"$CURRENT_TIME\"^^<http://www.w3.org/2001/XMLSchema#dateTime>.

    <http://redpencil.data.gift/id/task/$TASK_UUID> mu:uuid \"$TASK_UUID\".
    <http://redpencil.data.gift/id/task/$TASK_UUID> <http://redpencil.data.gift/vocabularies/tasks/index> 0.
    <http://redpencil.data.gift/id/task/$TASK_UUID> <http://redpencil.data.gift/vocabularies/tasks/operation> <http://redpencil.data.gift/id/jobs/concept/TaskOperation/deltas/deltaDumpFileCreation>.
    <http://redpencil.data.gift/id/task/$TASK_UUID> a <http://redpencil.data.gift/vocabularies/tasks/Task>.
    <http://redpencil.data.gift/id/task/$TASK_UUID> adms:status <http://redpencil.data.gift/id/concept/JobStatus/scheduled>.
    <http://redpencil.data.gift/id/task/$TASK_UUID> dct:created \"$CURRENT_TIME\"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
    <http://redpencil.data.gift/id/task/$TASK_UUID> dct:isPartOf <http://redpencil.data.gift/id/job/$JOB_UUID>.
    <http://redpencil.data.gift/id/task/$TASK_UUID> dct:modified \"$CURRENT_TIME\"^^<http://www.w3.org/2001/XMLSchema#dateTime>.
}
}
"""
ENCODED_SPARQL_UPDATE=$(echo "$SPARQL_UPDATE" | sed -e 's/ /%20/g' -e "s/\n/%0A/g" -e 's/"/%22/g')

curl -X POST "$ENDPOINT" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "MU-AUTH-SUDO: true" \
     --data "update=$ENCODED_SPARQL_UPDATE"

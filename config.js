import env from 'env-var';

export const HOST = env.get('VIRTUOSO_HOSTNAME').required().asString();
export const USERNAME = env.get('VIRTUOSO_USERNAME').default("dba").asString();
export const PASSWORD = env.get('VIRTUOSO_PASSWORD').default("dba").asString();
export const TASK_OPERATION = env.get('JOB_OPERATION').default('http://redpencil.data.gift/id/jobs/concept/TaskOperation/deltas/deltaDumpFileCreation').asString();
export const FILES_GRAPH = env.get('FILES_GRAPH').default('http://mu.semte.ch/graphs/public').asString();
export const DCAT_DATASET_GRAPH = env.get('DCAT_DATASET_GRAPH').default('http://mu.semte.ch/graphs/public').asString();
export const GRAPH_TO_DUMP =  env.get('GRAPH_TO_DUMP').default('http://mu.semte.ch/graphs/public').asString();
export const RELATIVE_FILE_PATH = env.get('RELATIVE_FILE_PATH').default('delta-producer-dumps').asString();
export const JOBS_GRAPH =  env.get('JOBS_GRAPH').default('http://mu.semte.ch/graphs/system/jobs').asString();
export const CLEAN_OLD_DUMPS = env.get('CLEAN_OLD_DUMPS').default("true").asBool();
export const DATASET_URI = env.get('DATASET_URI').required().asString();
export const MU_SPARQL_ENDPOINT = env.get('MU_SPARQL_ENDPOINT').required().asString();
export const SERVICE_NAME = env.get('SERVICE_NAME').default('graph-dump-service').asString();

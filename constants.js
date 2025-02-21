export const STATUS_BUSY = 'http://redpencil.data.gift/id/concept/JobStatus/busy';
export const STATUS_SCHEDULED = 'http://redpencil.data.gift/id/concept/JobStatus/scheduled';
export const STATUS_FAILED = 'http://redpencil.data.gift/id/concept/JobStatus/failed';
export const STATUS_SUCCESS = 'http://redpencil.data.gift/id/concept/JobStatus/success';

export const ERROR_TYPE= 'http://open-services.net/ns/core#Error';
export const ERROR_URI_PREFIX = 'http://redpencil.data.gift/id/jobs/error/';
export const ERROR_CREATOR_URI = 'http://lblod.data.gift/services/delta-producer-dump-file-publisher';

export const PREFIXES = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX prov: <http://www.w3.org/ns/prov#>
  PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX oslc: <http://open-services.net/ns/core#>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX dbpedia: <http://dbpedia.org/resource/>
  PREFIX dcat: <http://www.w3.org/ns/dcat#>
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
`;

export const JOB_TYPE = 'http://vocab.deri.ie/cogs#Job';
export const TASK_TYPE = 'http://redpencil.data.gift/vocabularies/tasks/Task';
export const DELTA_ERROR_TYPE = 'http://redpencil.data.gift/vocabularies/deltas/Error';
export const DCAT_DATASET_TYPE = 'http://data.lblod.info/vocabularies/datasets/DeltaCacheGraphDump';

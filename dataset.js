import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import mu, { sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeInt, sparqlEscapeUri } from 'mu';
import path from 'path';
import fs from 'fs';
import { generateDumpFile, deleteDumpFile, createCompressedDump } from './helpers';
import {
  DCAT_DATASET_GRAPH,
  SERVICE_NAME,
  FILES_GRAPH,
  MU_SPARQL_ENDPOINT,
  GRAPH_TO_DUMP
} from './config';
import { PREFIXES, DCAT_DATASET_TYPE } from './constants';

/*
 * Based on https://github.com/kanselarij-vlaanderen/dcat-dataset-publication-service
 * Courtesy: https://github.com/Annelies-P, Erika
 */
export class DatasetManager {
  constructor(dcatDataSetSubject, targetDcatGraph, targetFilesGraph, cleanupOldDumps){
    this.dcatDataSetSubject = dcatDataSetSubject;
    this.graphToDump = GRAPH_TO_DUMP;
    this.publicationGraphEndpoint =  MU_SPARQL_ENDPOINT;
    this.dcatGraph = targetDcatGraph || DCAT_DATASET_GRAPH;
    this.filesGraph = targetFilesGraph || FILES_GRAPH;
    this.cleanupOldDumps = cleanupOldDumps || false;
  }
  /**
   * @public
   */
  async createDumpFile() {
    this.filePath = await generateDumpFile(this.graphToDump, this.publicationGraphEndpoint);
    if(!this.filePath){
      return;
    }
    else {
      this.compressedFilePath = await createCompressedDump(this.filePath);
      await this.generateDataset();
      await this.generateTtlDistribution();
      await this.generateCompressedDistribution();
      if(this.cleanupOldDumps) {
        await this.deletePrevious();
      } else {
        await this.deprecatePrevious();
      }
      return { ttlPath: this.filePath, compressedPath: this.compressedFilePath };
    }
  }

  /**
   * Create the new dataset
   *
   * @private
   */
  async generateDataset() {
    const uuid = mu.uuid();
    const uri = `http://data.lblod.info/id/dataset/${uuid}`;
    const now = Date.now();
    const queryStr = `
      ${PREFIXES}

      INSERT DATA {
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
          <${uri}> a dcat:Dataset ;
            mu:uuid "${uuid}" ;
            dct:type  ${sparqlEscapeUri(DCAT_DATASET_TYPE)};
            dct:subject ${sparqlEscapeUri(this.dcatDataSetSubject)};
            dct:created ${sparqlEscapeDateTime(now)} ;
            dct:modified ${sparqlEscapeDateTime(now)} ;
            dct:issued ${sparqlEscapeDateTime(now)} ;
            dct:title """Delta producer cache graph dump""" .
        }
      }
    `;
    await update(queryStr);

    this.datasetUri = uri;

    console.log(`Generated dataset ${this.datasetUri}`);
  }

  /**
   * Create a FileDataObject and distribution for a file
   *
   * @private
   */
  async generateDistribution(filePath, format, titleSuffix = '') {
    const now = Date.now();
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);
    const fileStats = fs.statSync(filePath);
    const created = new Date(fileStats.birthtime);
    const size = fileStats.size;

    const logicalFileUuid = mu.uuid();
    const logicalFileUri = `http://data.lblod.info/id/file/${logicalFileUuid}`;

    const physicalFileUuid = mu.uuid();
    const physicalFileUri = filePath.replace('/share/', 'share://');

    const distributionUuid = mu.uuid();
    const distributionUri = `http://data.lblod.info/id/distribution/${distributionUuid}`;

    await update(`
      ${PREFIXES}

      INSERT {
        GRAPH ${sparqlEscapeUri(this.filesGraph)} {
          ${sparqlEscapeUri(logicalFileUri)} a nfo:FileDataObject ;
            mu:uuid ${sparqlEscapeString(logicalFileUuid)} ;
            nfo:fileName ${sparqlEscapeString(fileName)} ;
            dct:format ${sparqlEscapeString(format)} ;
            nfo:fileSize ${sparqlEscapeInt(size)} ;
            dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
            dct:creator ${sparqlEscapeUri(SERVICE_NAME)} ;
            dct:created ${sparqlEscapeDateTime(created)} .

          ${sparqlEscapeUri(physicalFileUri)} a nfo:FileDataObject ;
            mu:uuid ${sparqlEscapeString(physicalFileUuid)} ;
            nfo:fileName ${sparqlEscapeString(fileName)} ;
            dct:format ${sparqlEscapeString(format)} ;
            nfo:fileSize ${sparqlEscapeInt(size)} ;
            dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
            dct:created ${sparqlEscapeDateTime(created)} ;
            nie:dataSource ${sparqlEscapeUri(logicalFileUri)} .
        }
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
           ${sparqlEscapeUri(distributionUri)} a dcat:Distribution ;
            mu:uuid "${distributionUuid}" ;
            dct:subject ${sparqlEscapeUri(logicalFileUri)} ;
            dct:created ${sparqlEscapeDateTime(now)} ;
            dct:modified ${sparqlEscapeDateTime(now)} ;
            dct:issued ${sparqlEscapeDateTime(now)} ;
            dcat:byteSize ${sparqlEscapeInt(size)} ;
            dct:format ${sparqlEscapeString(format)} ;
            dct:title ?finalTitle .
            ?dataset dcat:distribution ${sparqlEscapeUri(distributionUri)} .
        }
      }
      WHERE {
        BIND(${sparqlEscapeUri(this.datasetUri)} as ?dataset)
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
          ?dataset dct:title ?title
        }
        BIND(${titleSuffix ? `CONCAT(?title, ${sparqlEscapeString(titleSuffix)})` : '?title'} as ?finalTitle)
      }
    `);
  }

  async generateTtlDistribution() {
    await this.generateDistribution(this.filePath, 'text/turtle');
  }

  async generateCompressedDistribution() {
    await this.generateDistribution(this.compressedFilePath, 'application/x-xz', ' (XZ compressed)');
  }

  async getPreviousDatasets( lastRevisionOnly = true ) {
    const results = (await query(`
    ${PREFIXES}
    SELECT DISTINCT ?dataset ?distribution
    WHERE {
      GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
        ?dataset a dcat:Dataset ;
          dcat:distribution ?distribution;
          dct:type ${sparqlEscapeUri(DCAT_DATASET_TYPE)};
          dct:subject ${sparqlEscapeUri(this.dcatDataSetSubject)}.
      }
      ${ lastRevisionOnly ? 'FILTER NOT EXISTS { ?newerVersion prov:wasRevisionOf ?dataset . }' : '' }
      FILTER ( ?dataset NOT IN (${sparqlEscapeUri(this.datasetUri)} ) )
    }
    `)).results;

    const datasets = results.bindings ? results.bindings.map(d => {
      return {dataset: d.dataset.value, distribution: d.distribution.value};
    }) : [];

    if(lastRevisionOnly && datasets.length > 1){
      throw( `We exepected max 1 previous revision,
              instead we got ${datasets.join('\n')}`);
    }
    return datasets;
  }

  async deletePrevious() {
    const datasets = await this.getPreviousDatasets(false);
    for(const { distribution, dataset } of datasets) {
      try {
        const queryFile = `
          ${PREFIXES}

          SELECT DISTINCT ?logicalFileUri ?physicalFile
          where {
            GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
              ${sparqlEscapeUri(distribution)} dct:subject ?logicalFileUri.
            }
            GRAPH ${sparqlEscapeUri(this.filesGraph)} {
              ?physicalFile nie:dataSource ?logicalFileUri.
            }
          }
        `;
        const results = await query(queryFile);
        const entry = results?.results?.bindings[0];

        if(entry) {
          const deleteDistribution = `
            ${PREFIXES}
            DELETE {
              GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
                ?distribution ?dP ?dO.
              }
              GRAPH ${sparqlEscapeUri(this.filesGraph)} {
                ?physicalFileUri ?p1 ?o1.
                ?logicalFileUri ?p2 ?o2.
              }
            } WHERE {

              BIND(${sparqlEscapeUri(distribution)} as ?distribution)
              BIND(${sparqlEscapeUri(entry.logicalFileUri.value)} as ?logicalFileUri)
             {
                GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
                  ?distribution dct:subject ?logicalFileUri;
                  ?dP ?dO.
                }
             } UNION {
                GRAPH ${sparqlEscapeUri(this.filesGraph)} {
                  ?physicalFileUri a nfo:FileDataObject ;
                                   nie:dataSource ?logicalFileUri.
                  ?physicalFileUri ?p1 ?o1.
                  ?logicalFileUri ?p2 ?o2.
                }
             }
            }
          `;
          await update(deleteDistribution);
        }
        else {
          console.warn(`No (meta) file data found for distribution: ${distribution}`);
        }

        const deleteDatasetQuery = `
          ${PREFIXES}
          DELETE {
            GRAPH ?g {
              ?s ?p ?o.
            }
          }
          WHERE {
            VALUES ?s {
              ${sparqlEscapeUri(dataset)}
            }
            GRAPH ?g {
              ?s ?p ?o.
            }
          }
        `;
        await update(deleteDatasetQuery);
        await deleteDumpFile(entry.physicalFile.value);
      }
      catch (error) {
        console.error(`
        Something went wrong cleaning up:
          dataset:  ${dataset}
          distribution: ${distribution}
        `);
        console.error(`${error?.message || error}`);
      }
    }
  }

  /**
   * Deprecate the previous dataset
   *  - search for any previous dataset
   *  - mark it as prov:wasRevisionOf of the current dataset
   *  - update the modified:date
   *
   * @public
   */
  async deprecatePrevious() {
   const datasets = await this.getPreviousDatasets();

    if (datasets.length == 1) {
      const previousDataset = datasets[0];
      console.log(`Found previous dataset <${previousDataset.dataset}>`);

      await update(`
        ${PREFIXES}
        INSERT DATA {
          GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
            ${sparqlEscapeUri(this.datasetUri)} prov:wasRevisionOf ${sparqlEscapeUri(previousDataset.dataset)} .
          }
        }
      `);
      await this.deprecateDistributions(previousDataset.dataset);
    }
  }

  async deprecateDistributions(previousDataset) {
    console.log(`Deprecating distributions belonging to previous dataset <${previousDataset}>`);
    await update(`
      ${PREFIXES}
      DELETE {
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
          ${sparqlEscapeUri(previousDataset)} dct:modified ?datasetModifiedDate ;
            dct:modified ?distributionModifiedDate .
        }
      } WHERE {
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
          ${sparqlEscapeUri(previousDataset)} dcat:distribution ?distribution ;
                                              dct:modified ?datasetModifiedDate .
          ?distribution dct:modified ?distributionModifiedDate .
        }
      }
    `);

    const now = Date.now();

    await update(`
      ${PREFIXES}

      INSERT {
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
          ?distribution dct:modified ${sparqlEscapeDateTime(now)} .
          ${sparqlEscapeUri(previousDataset)} dct:modified ${sparqlEscapeDateTime(now)} .
        }
      } WHERE {
        GRAPH ${sparqlEscapeUri(this.dcatGraph)} {
          ${sparqlEscapeUri(previousDataset)} dcat:distribution ?distribution .
        }
      }
    `);
  }

}

import odbc from 'odbc';
import fs from 'fs/promises';
import path from 'path';
import { uuid, sparqlEscapeUri,sparqlEscapeString } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'node:zlib';
import { DatasetManager } from './dataset';
import {
  HOST,
  USERNAME,
  PASSWORD,
  DCAT_DATASET_GRAPH,
  DATASET_URI,
  FILES_GRAPH,
  CLEAN_OLD_DUMPS,
  TASK_OPERATION,
  RELATIVE_FILE_PATH
} from './config';

import {
  PREFIXES,
  JOB_TYPE,
  TASK_TYPE,
  STATUS_BUSY,
  STATUS_SUCCESS,
  STATUS_SCHEDULED,
  STATUS_FAILED
} from './constants';


export async function ensureDumpPathExists() {
  const dirPath = path.join('/share', RELATIVE_FILE_PATH);
  await fs.mkdir(dirPath, { recursive: true });
}

// NOTE: currently assumes graph output will not exceed 1000000000000
export async function generateDumpFile(graphToDump ) {
  const db = await getDbConnection();
  try {
    console.log('started generating dump file at', new Date().toISOString());
    const id = uuid();
    await db.query(`CALL dump_one_graph('${graphToDump}','./dumps/${id}-',1000000000000)`);
    console.log('finished generating dump file at', new Date().toISOString());
    console.log('moving file & creating dataset metadata');
    const fileName = `graph-dump-${new Date().toISOString().replace(/:|\./g, '')}-${uuid()}.ttl`;
    const sourcePath = path.join('/dumps', `${id}-000001.ttl`);
    const destinationPath = path.join('/share', RELATIVE_FILE_PATH, fileName);
    await moveFile(sourcePath, destinationPath);
    return destinationPath;
  }
  catch(e) {
    console.log(e.stack);
    throw e;
  }
  finally {
    db.close();
  }
}

/**
 * Updates the status of the given resource
 */
export async function updateStatus(uri, status) {
  const q = `
    PREFIX adms: <http://www.w3.org/ns/adms#>

    DELETE {
      GRAPH ?g {
        ${sparqlEscapeUri(uri)} adms:status ?status .
      }
    }
    INSERT {
      GRAPH ?g {
        ${sparqlEscapeUri(uri)} adms:status ${sparqlEscapeUri(status)} .
      }
    }
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(uri)} adms:status ?status .
      }
    }
  `;
  await update(q);
}


export async function produceDumpFile(task) {
  try {
    console.log(`Generating dump file for task ${task}.`);
    const manager = new DatasetManager(DATASET_URI,
                                       DCAT_DATASET_GRAPH,
                                       FILES_GRAPH,
                                       CLEAN_OLD_DUMPS);
    await updateStatus(task, STATUS_BUSY);
    const result = await manager.createDumpFile();
    if (result) {
      await createResultContainer(task, [result.ttlPath, result.compressedPath]);
      await updateStatus(task, STATUS_SUCCESS);
    }
    else {
      throw "did not receive result";
    }
  } catch (e) {
    console.error(`An error occured while creating dump file for task ${task}: ${e}`);
    console.error(e.stack);
    await updateStatus(task, STATUS_FAILED);
  }
}

async function createResultContainer(task, files) {
  const containerUUID = uuid();
  const containerUri = `http://internal.example.com/container/${containerUUID}`;

  // Create the container first
  await update(`
     ${PREFIXES}
     INSERT {
       GRAPH ?g {
         ?task <http://redpencil.data.gift/vocabularies/tasks/resultsContainer> ${sparqlEscapeUri(containerUri)}.
         ${sparqlEscapeUri(containerUri)} a <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#DataContainer>;
                                          <http://mu.semte.ch/vocabularies/core/uuid> ${sparqlEscapeString(containerUUID)}.
       }
     }
     WHERE {
       BIND(${sparqlEscapeUri(task)} as ?task)
       GRAPH ?g {
         ?task a <http://redpencil.data.gift/vocabularies/tasks/Task>
       }
     }
  `);

  // Link each file to the container
  for (const file of files) {
    const fileUri = file.replace('/share/', 'share://');
    await update(`
       ${PREFIXES}
       INSERT {
         GRAPH ?g {
           ${sparqlEscapeUri(containerUri)} <http://redpencil.data.gift/vocabularies/tasks/hasFile> ?file.
           ?file ?p ?o.
           ?logicalFile ?lp ?lo.
         }
       }
       WHERE {
         BIND(${sparqlEscapeUri(fileUri)} as ?file)
         GRAPH ?g {
           ${sparqlEscapeUri(containerUri)} a <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#DataContainer>
         }
         GRAPH ${sparqlEscapeUri(FILES_GRAPH)} {
           ?file nie:dataSource ?logicalFile; ?p ?o.
           ?logicalFile a nfo:FileDataObject; ?lp ?lo.
         }
       }
    `);
  }
}

async function moveFile(sourcePath, destinationPath) {
  try {
    // using copy and unlink instead of rename to avoid errors about cross-device linking
    await fs.copyFile(sourcePath, destinationPath);
    await fs.unlink(sourcePath);
    console.log(`File moved to ${destinationPath}`);
  } catch (err) {
    console.error('Error moving file:', err);
  }
}

export async function createCompressedDump(ttlFilePath) {
  try {
    console.log('started compressing dump file at', new Date().toISOString());
    const compressedFileName = path.basename(ttlFilePath) + '.gz';
    const compressedPath = path.join(path.dirname(ttlFilePath), compressedFileName);

    const readStream = createReadStream(ttlFilePath);
    const writeStream = createWriteStream(compressedPath);
    const compressor = createGzip({ level: 6 });

    await pipeline(readStream, compressor, writeStream);
    console.log('finished compressing dump file at', new Date().toISOString());
    return compressedPath;
  } catch (err) {
    console.error('Error compressing file:', err);
    throw err;
  }
}

export async function deleteDumpFile(pFile) {
  try {
    const filePath = pFile.replace("share://", "/share/");
    await fs.unlink(filePath);
  }
  catch(error){
    console.warn(`Error removing file ${pFile}`);
    console.error(`${error?.message || error}`);
  }
}


async function getDbConnection() {
  return await odbc.connect(`Driver=/usr/lib/virtodbcu_r.so;Host=${HOST};Port=1111;UID=${USERNAME};PWD=${PASSWORD}`);
}

export async function createStoredProcedure() {
  const db = await getDbConnection();
  try {
    const sql = await fs.readFile('dump-one-graph.sql', 'utf-8');
    await db.query(sql);
    console.log('Stored procedure dump_one_graph created successfully.');
  }
  finally {
    await db.close();
  }
}

export async function mayBeTaskOfInterest(taskUri) {
  const q = `
    ${PREFIXES}

    SELECT DISTINCT ?job ?task ?jobOperation WHERE {
      BIND(${sparqlEscapeUri(taskUri)} as ?task)
      GRAPH ?g {
          ?job a ${sparqlEscapeUri(JOB_TYPE)};
            task:operation ?jobOperation.

          ?task dct:isPartOf ?job;
            a ${sparqlEscapeUri(TASK_TYPE)};
            task:operation <http://redpencil.data.gift/id/jobs/concept/TaskOperation/deltas/deltaDumpFileCreation>;
            adms:status ${sparqlEscapeUri(STATUS_SCHEDULED)}.
       }
    }
  `;
  const queryResult = await query(q);
  return parseResult(queryResult)[0];
}


/**
 * convert results of select query to an array of objects.
 * @method parseResult
 * @return {Array}
 */
function parseResult( result ) {
  if(!(result.results && result.results.bindings.length)) return [];

  const bindingKeys = result.head.vars;
  return result.results.bindings.map((row) => {
    const obj = {};
    bindingKeys.forEach((key) => {
      if(row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#integer' && row[key].value){
        obj[key] = parseInt(row[key].value);
      }
      else if(row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#dateTime' && row[key].value){
        obj[key] = new Date(row[key].value);
      }
      else obj[key] = row[key] ? row[key].value:undefined;
    });
    return obj;
  });
}

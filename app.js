import bodyParser from 'body-parser';
import { app, errorHandler } from 'mu';
import { TASK_OPERATION, RELATIVE_FILE_PATH } from './config';
import { STATUS_SCHEDULED } from './constants';
import { mayBeTaskOfInterest, createStoredProcedure, produceDumpFile, ensureDumpPathExists } from './helpers';

// on startup make sure our procedure is present in virtuoso
createStoredProcedure();
ensureDumpPathExists();

app.get('/', function( req, res ) {
  res.send('Hello from delta-snapshot-publisher');
} );

app.post('/delta', bodyParser.json({ limit: '500mb' }), async function( req, res ) {
  try {
    const delta = req.body;
    const inserts = delta.flatMap(changeSet => changeSet.inserts);
    if(!inserts.length){
      res.status(204).send();
    }
    else {
      const task = await getScheduledDumpTask(inserts);
      if (task && task.jobOperation == TASK_OPERATION ) {
        produceDumpFile(task.task); // Not awaiting to avoid socket hangup in deltanotifier
        res.send({message: `Dump file production started`});
      }
      else {
        console.log('Incoming deltas do not contain any busy job, skipping.');
        res.status(204).send();
      }
    }
  }
  catch(e){
    const msg = `General error with creating dump file: ${e}`;
    console.error(msg);
  }
});

app.use(errorHandler);


async function getScheduledDumpTask(inserts) {
  const task = inserts.filter( triple => {
    return triple.predicate.type == 'uri'
      && triple.predicate.value == 'http://www.w3.org/ns/adms#status'
      && triple.object.type == 'uri'
      && triple.object.value == STATUS_SCHEDULED;
  }).map(triple => triple.subject.value)[0]; // assume one une task per deltas

  if(task){
    const taskDetails = await mayBeTaskOfInterest(task);
    return taskDetails ? taskDetails : null;
  }
  return null;

}


//generateDumpFile('foo', 'http://mu.semte.ch/graphs/public');

const fs = require('fs');
const fsp = require('fs').promises
const os = require('os');
const path = require('path');

const fstream = require('fstream')
const unzipper = require('unzipper');

const snappier = require('./snappier')
const protobufStreamParser = require('./protobufStreamParser')

function extractIWAFile(iwaFileStream, keynoteArchivesMap) {
  return new Promise(resolve => {
    const out = iwaFileStream.pipe(snappier()).pipe(protobufStreamParser())
    out.on('error', err => {
      resolve(err)
    })
    out.on('data', obj => {
      keynoteArchivesMap[obj.archiveInfo.identifier] = obj
    })
    out.on('end', () => {
      resolve(null);
    })
  })
}

function keynote(inputKeyfileStream) {
  return new Promise(async (resolve, reject) => {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'keynoteParser-'));
    const outputDirectoryWriter = fstream.Writer(tmpDir);

    const keynoteArchivesMap = {}

    outputDirectoryWriter.on('close', async () => {
      const indexFiles = await fsp.readdir(path.join(tmpDir, 'Index'))
      const iwaFiles = indexFiles.filter(a => a.endsWith('.iwa')).map(fName => path.join(tmpDir, 'Index', fName))

      const errors = await Promise.all(iwaFiles.map(fPath => fs.createReadStream(fPath)).map(stream => extractIWAFile(stream, keynoteArchivesMap)))

      resolve(keynoteArchivesMap)
    })

    inputKeyfileStream.pipe(unzipper.Parse()).pipe(outputDirectoryWriter)
  })
}

module.exports = keynote;

const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

module.exports.delay = (ms) => {
  return new Promise(res => {
    setTimeout(res, ms);
  });
};

const minLatency = 40;
const maxLatency = 80;

/**
 * Fake latency generator. Always between 60 and 100ms
 */
module.exports.latency = () => {

  return module.exports.delay(
    Math.round(Math.random()*(maxLatency-minLatency)+minLatency)
  );

}

module.exports.generateHalItem = async(id, uriPrefix, uriPostfix) => {

  const data = await readFile(__dirname + '/../data/' + id + '.json');
  const body = JSON.parse(data);
  body._links = {
    self: { href:  uriPrefix + '/' + id + uriPostfix },
    collection: { href: uriPrefix + uriPostfix },
  };

  // this is a special marker that will light up the frontend
  body.p = 0;;

  return body;

}

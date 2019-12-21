const router = require('@curveball/router').default;
const fs = require('fs');

module.exports = function(uri, path, type) {

  return router(
    uri
  ).get( ctx => {
    ctx.response.type = type;
    ctx.response.body = fs.readFileSync(__dirname + '/../' + path);
  });

}

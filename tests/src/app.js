const { Application } = require('@curveball/core');
const staticFile = require('./static');
const router = require('@curveball/router').default;
const HalCollection = require('./hal-collection');
const HalCollectionCompound = require('./hal-collection-compound');
const HalItem = require('./hal-item');
const https = require('https');
const http2 = require('http2');
const fs = require('fs');

const httpsOptions = {
  key: fs.readFileSync(__dirname + '/../keys/localhost.key'),
  cert: fs.readFileSync(__dirname + '/../keys/localhost.crt')
};

const app = new Application();

app.use(async (ctx, next) => {

  console.log(ctx.method, ctx.path);
  await next();
  console.log(ctx.status);

});

app.use(router('/collection', new HalCollection()));
app.use(router('/collection/:id', new HalItem()));
app.use(router('/compound', new HalCollectionCompound()));
app.use(router('/cached', new HalCollection({
  cached: true,
  prefix: '/cached',
})));
app.use(router('/cached/:id', new HalItem({
  cached: true,
  prefix: '/cached',
})));
app.use(router('/cached2', new HalCollection({
  cached: true,
  prefix: '/cached2',
  mustRevalidate: true,
})));
app.use(router('/cached2/:id', new HalItem({
  cached: true,
  prefix: '/cached2',
  mustRevalidate: true,
})));

app.use(staticFile('/', 'client/index.html', 'text/html'));
app.use(staticFile('/style.css', 'client/style.css', 'text/css'));
app.use(staticFile('/test-client.js', 'client/test-client.js', 'text/javascript'));
app.use(staticFile('/ketting.js', 'node_modules/ketting/browser/ketting.min.js', 'text/javascript'));



console.log('Listening on port 8081 for HTTP');
app.listen(8081);

console.log('Listening on port 8082 for HTTPS');
const httpsServer = https.createServer(httpsOptions, app.callback());
httpsServer.listen(8082);

console.log('Listening on port 8083 for HTTP/2');
const http2Server = http2.createSecureServer(httpsOptions, app.callback()); 
http2Server.listen(8083);


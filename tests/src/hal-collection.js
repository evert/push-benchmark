const Controller = require('@curveball/controller').default;
const { delay, generateHalItem } = require('./util');

class HalCollection extends Controller {

  constructor(options = {}) {

    super();
    this.cached = options.cached || false;
    this.prefix = options.prefix || '/collection';

  }

  async get(ctx) {

    // fake latency
    await delay(30);

    const responseCount = ctx.query.count ? parseInt(ctx.query.count,10) : 100;

    const cacheBuster = ctx.query.cacheBuster ? '?cacheBuster=' + ctx.query.cacheBuster : '';

    const responseBody = {
      _links: {
        self: { href: this.prefix + cacheBuster },
        item: []
      },
      total: responseCount,
    };

    const push = ctx.request.headers.has('Prefer-Push');

    const promises = [];
    for(var i=1; i <= responseCount; i++) {
      responseBody._links.item.push({
        href: this.prefix +  '/' + i + cacheBuster,
      });
      if (push) {
        promises.push(this.pushItem(ctx, i, cacheBuster));
      }
    }

    ctx.response.body = responseBody;

  }

  async pushItem(ctx, id, cacheBuster) {

    await ctx.push( async pushCtx => {

      console.log(pushCtx.status);
      pushCtx.request.path = this.prefix + '/' + id + cacheBuster;
      
      console.log('pushing', pushCtx.request.requestTarget);
      pushCtx.response.headers.set('Content-Type', 'application/hal+json');
      pushCtx.response.body = await generateHalItem(id, this.prefix, cacheBuster)
      // Adding a marker to demonstrate the response was pushed
      pushCtx.response.body.p = 1;

    });

  }

}

module.exports = HalCollection;

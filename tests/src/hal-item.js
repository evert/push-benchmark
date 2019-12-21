const Controller = require('@curveball/controller').default;
const { latency, generateHalItem } = require('./util');

class HalItem extends Controller {

  constructor(options = {}) {

    super();
    this.cached = options.cached || false;
    this.prefix = options.prefix || '/collection';
    this.mustRevalidate = options.mustRevalidate || false;

  }

  async get(ctx) {

    // fake latency
    await latency();

    const cacheBuster = ctx.query.cacheBuster ? '?cacheBuster=' + ctx.query.cacheBuster : '';
    const id = parseInt(ctx.state.params.id, 10);

    let version = 1;

    if (this.mustRevalidate) {

      // Logic for the 'must-revalidate' case
      if (ctx.request.headers.has('If-None-Match')) {

        if (id % 10 !== 0) {
          // Assume it was correct.
          ctx.status = 304;
          return;
        } else {
          version = 2;

        }

      }
      ctx.response.body = await generateHalItem(
        id,
        this.prefix,
        cacheBuster
      );
      if (version === 2) ctx.response.body.p = 2;
      const etag = `"item-${id}-version-${version}"`;
      ctx.response.headers.set('ETag', etag); 
      ctx.response.headers.set('Cache-Control', 'public, must-revalidate');
      return;
    } else {

      ctx.response.body = await generateHalItem(
        id,
        this.prefix,
        cacheBuster
      );

      let version = 0;

      if (ctx.request.headers.has('If-None-Match')) {
        // Indicate that this was a fresh response
        // This tells the frontend the item did not come
        // from a cache.
        ctx.response.body.p = 2;
        version++;
      }
      const etag = `"item-${id}-version-${version}"`;

      // Set a cache item, except if the id is divisable by 10
      if (this.cached && id % 10 !== 0) {
        ctx.response.headers.set('Cache-Control', 'max-age=600000, public');
      }

      ctx.response.headers.set('Vary', 'Accept');
      ctx.response.headers.set('ETag', etag);

    }
  }

}

module.exports = HalItem;

const Controller = require('@curveball/controller').default;
const { latency, generateHalItem } = require('./util');

class HalCollection extends Controller {

  async get(ctx) {

    // fake latency
    await latency();

    const responseCount = ctx.query.count ? parseInt(ctx.query.count,10) : 100;

    const cacheBuster = ctx.query.cacheBuster ? '?cacheBuster=' + ctx.query.cacheBuster : '';

    const responseBody = {
      _links: {
        self: { href: '/compound' + cacheBuster },
        item: []
      },
      total: responseCount,
      _embedded: {
        item: []
      },
    };

    for(var i=1; i <= responseCount; i++) {

      responseBody._links.item.push({
        href: '/compound/' + i + cacheBuster,
      });

      const subBody = await generateHalItem(i, '/compound', cacheBuster);
      subBody.p = 3;
      responseBody._embedded.item.push(subBody);

    }

    ctx.response.body = responseBody;

  }

}

module.exports = HalCollection;

document.addEventListener('DOMContentLoaded', main);

const testData = {

  'h1-nocache': {
    httpVersion: '1.1',
    byLine: 'HTTP/1.1 is limited to 6 concurrent requests',
  },

}

function main() {

  const containers = document.getElementsByClassName('parafake');

  for(const container of containers) {

    loadTestSample(container, container.dataset.id);

  }

}

const gridSize = 200;

function loadTestSample(elem, id) {

  const test = testData[id];
  renderTemplate(elem, test);
  const grid = renderGrid(elem.getElementsByClassName('blocks')[0]);

  elem.getElementsByTagName('button', () => {
    startTest(test, grid);
  });

}

function renderTemplate(elem, test)  {

  elem.innerHTML = `<h3>${gridSize} requests via HTTP/${test.httpVersion}</h3>
<div class="blocks">
</div>
<p>${test.byline}</p>
<div class="controls"><button>Start</button></div>
`;

}

function renderGrid(elem) {
  const grid = [];
  for(let i = 0; i < gridSize; i++ ) {

    const span = document.createElement('span');
    grid.push(span);
    elem.appendChild(span);

  }

  return grid;
}

function delay(ms) {
  return new Promise( res => {
    setTimeout(res, ms);
  });
}

async function startTest(test, grid) {

  for(const cell of grid) {
    cell.className = '';
  }

  const promises = [];
  const throttler = new RequestThrottler(6);

  for(const cell of grid) {
    // Adding a tiny delay since there is a small
    // amount of overhead in kicking off a request
    await delay(10);

    promises.push(async () => {
      await throttler.go()
      cell.className = 'received';
    });
  }

  await Promise.all(promises);

}

const minLatency = 100;
const maxLatency = 150;

class RequestThrottler {

  constructor(maxConcurrency) {

    this.maxConcurrency = maxConcurrency;
    this.queuedRequests = [];
    this.inFlightCount = 0;

  }

  go() {

    let resolver;

    // This is the promise we're eventually resolving
    const resultPromise = new Promise(res, rej => {
      resolver = res;
    });

    if (this.inFlightCount < this.maxConcurrency) {

      this.request().then( () => {
        resolver();
        this.checkQueue();
      });

    } else {
      this.queuedRequests.push(resolver);
    }

    return resultPromise;

  }

  async request() {

    this.inFlightCount++;
    await delay(Math.random() * (maxLatency - minLatency) + minLatency);
    this.inFlightCount--;

  }

  async checkQueue() {

    if (this.inFlightCount < this.maxConcurrency && this.queuedRequests.length) {

      const resolver = this.queuedRequests.shift();
      await this.request();
      resolver();

    }

  }

}

document.addEventListener('DOMContentLoaded', main);

const testData = {

  'h1-nocache': {
    httpVersion: '1.1',
    title: '100 requests via HTTP/1.1',
    byline: 'HTTP/1.1 is limited to 6 concurrent requests',
    mode: 'normal',
  },
  'h1-compound': {
    httpVersion: '1.1',
    title: 'Compounding 100 items in a collection',
    byline: 'Combining many logical entities in 1 bulky response has major speed benefits.',
    mode: 'compound',
  },
  'h2-nocache': {
    httpVersion: '2',
    title: '100 parallel requests via HTTP/2',
    byline: 'HTTP/2 can fire off many parallel requests over 1 TCP connection',
    mode: 'normal',
  },
  'h2-push': {
    httpVersion: '2',
    title: 'HTTP/2 Server Push',
    byline: 'With HTTP/2 Server Push, entities can arrive earlier because the client doesn\'t have to wait',
    mode: 'push',
  },

}

function main() {

  const containers = document.getElementsByClassName('parafake');

  for(const container of containers) {

    loadTestSample(container, container.dataset.id);

  }

}

const gridSize = 100;

function loadTestSample(elem, id) {

  const test = testData[id];
  renderTemplate(elem, test);
  const grid = renderGrid(elem.getElementsByClassName('blocks')[0]);

  elem.getElementsByTagName('button')[0].addEventListener('click', () => {
    startTest(test, grid);
  });

}

function renderTemplate(elem, test)  {

  elem.innerHTML = `<h3>${test.title}</h3>
<div class="blocks">
</div>
<div class="controls">
<p>${test.byline}</p>
<button>Start</button>
</div>

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

  switch(test.mode) {
    default :
      await parallelTest(test, grid);
      break;
    case 'compound' :
      await compoundTest(test, grid);
      break;
    case 'push':
      await pushTest(test, grid);
      break;
  }

}

async function parallelTest(test, grid) {

  const promises = [];
  const throttler = new RequestThrottler(test.httpVersion === '1.1' ? 6 : 1000);

  let first = true;

  for(const cell of grid) {
    // Adding a tiny delay since there is a small
    // amount of overhead in kicking off a request
    await delay(10);

    if (first) {
      first = false;
      // Hit for the first collection. This should block everything else.
      cell.className='loading';
      await slowRequest();
      cell.className = 'received';
      continue;
    }

    promises.push((async () => {
      await throttler.go(() => {
        cell.className = 'loading';
      })
      cell.className = 'received';
    })());
  }

  await Promise.all(promises);

}
async function pushTest(test, grid) {

  const promises = [];
  const throttler = new RequestThrottler(test.httpVersion === '1.1' ? 6 : 50);

  let first = true;

  for(const cell of grid) {
    // Adding a tiny delay since there is a small
    // amount of overhead in kicking off a request
    await delay(10);

    if (first) {
      first = false;
      // Hit for the first collection. This should block everything else.
      cell.className='loading';
      slowRequest().then( () => {
        // Little bit of extra delay
        return delay(minLatency/2);
      })
      .then( () => {
        cell.className = 'received';
      });
      // There's still some latency
      continue;
    }

    promises.push((async () => {
      await throttler.go(() => {
      })
      cell.className = 'pushed';
    })());
  }

  await Promise.all(promises);

}

async function compoundTest(test, grid) {

  let first = true;

  for(const cell of grid) {

    if (first) {

      first = false;
      // Hit for the first collection. This should block everything else.
      cell.className='loading';

      // Adding extra latency because the first request would take longer
      await delay(maxLatency);
      await slowRequest();
      cell.className = 'received';
      continue;
    }

    // All other cells return all at once
    cell.className = 'received';

  }

}

class RequestThrottler {

  constructor(maxConcurrency) {

    this.maxConcurrency = maxConcurrency;
    this.queuedRequests = [];
    this.inFlightCount = 0;

  }

  go(onStart = null) {

    let onEnd;

    // This is the promise we're eventually resolving
    const resultPromise = new Promise(res => {
      onEnd = res;
    });

    if (this.inFlightCount < this.maxConcurrency) {

      if (onStart) onStart();
      this.request().then( () => {
        onEnd();
        this.checkQueue();
      });

    } else {
      this.queuedRequests.push([onStart, onEnd]);
    }

    return resultPromise;

  }

  async request() {

    this.inFlightCount++;
    await slowRequest();
    this.inFlightCount--;

  }

  checkQueue() {

    if (this.inFlightCount < this.maxConcurrency && this.queuedRequests.length) {

      const [onStart, onEnd] = this.queuedRequests.shift();
      onStart();
      this.request().then(() => {
        onEnd();
        this.checkQueue();
      });

    }

  }

}

const minLatency = 1000;
const maxLatency = 1500;

/**
 * Pretends to be a slow request
 */
function slowRequest() {
  let ms;
  if (Math.floor(Math.random()*30)===0) {
    // Every 30 requests or so we'll pretend the connection was
    // choppy.
    ms = Math.random() * ((maxLatency*3) - minLatency) + minLatency
  } else {
    ms = Math.random() * (maxLatency - minLatency) + minLatency
  }
  return delay(ms);

}

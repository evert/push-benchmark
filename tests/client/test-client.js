document.addEventListener("DOMContentLoaded", main);

const itemCount = 500;

const http1Url = 'https://localhost:8082';
const http2Url = 'https://localhost:8083';

const tests = [
  {
    id: 1,
    label: 'h1, no cache',
    endPoint: http1Url + '/collection',
  },
  {
    id: 2,
    label: 'h1, no cache, compound',
    endPoint: http1Url + '/compound',
  },
  {
    id: 3,
    label: 'h1, 90% cached',
    endPoint: http1Url + '/cached',
    cached: true,
  },
  {
    id: 4,
    label: 'h2, no cache',
    endPoint: http2Url + '/collection',
  },
  {
    id: 5,
    label: 'h2, no cache, compound',
    endPoint: http2Url + '/compound',
  },
  {
    id: 6,
    label: 'h2, 90% not modified',
    endPoint: http2Url + '/cached2',
    cached: true,
  },
  {
    id: 7,
    label: 'h2, 90% cached',
    endPoint: http2Url + '/cached',
    cached: true,
  },
  {
    id: 8,
    label: 'h2, no cache, push',
    endPoint: http2Url + '/collection',
    push: true,
  },
];

function main() {

  populateNav();
  newGrid();

}

function populateNav() {

  const nav = document.getElementsByTagName('nav')[0];
  for(const test of tests) {

    const btn = document.createElement('button');
    btn.addEventListener('click', () => startTest(test) );
    btn.textContent = test.label;
    nav.appendChild(btn);

  }

}

function delay(ms) {

  return new Promise(res => {

    window.setTimeout( res, ms );

  });

}

async function startTest(test) {

  setResults(test, '');

  const randomId = Math.random();

  newGrid();

  let warmTime = 0;
  if (test.cached) {
    [warmTime] = await run(test, randomId, true);
    setResults(test, warmTime + 's', 'wait');
    await delay(100);
  }

  const [time, collectionTime] = await run(test, randomId);

  setResults(test, warmTime + 's', time + 's',collectionTime + 's');

}

async function run(test, randomId, isWarmup = false) {

  text('test-title', test.label);

  const collectionUrl = `${test.endPoint}?count=${itemCount}&cacheBuster=${randomId}`;

  const time = Date.now();
  const cTimeStart = Date.now();

  const headers = {};

  if (test.push) {
    headers['Prefer-Push'] = 'item';
  }

  const collectionResponse = await fetch(collectionUrl, {
    headers
  });

  const collectionBody = await collectionResponse.json();

  const cTime = Date.now()-cTimeStart;

  const promises = [];

  let count = 0;
  for(const itemLink of collectionBody._links.item) {

    const currentIndex = count;

    promises.push((async () => {

      let itemBody;

      // Is the item in _embedded
      if ('_embedded' in collectionBody && 'item' in collectionBody._embedded) {
        itemBody = collectionBody._embedded.item.find( subResource => {
          if (subResource._links.self.href === itemLink.href) {
            return subResource;
          }
        });
      }

      try {
        if (!itemBody) {
          // Fetch it from the web
          const itemResponse = await fetch(itemLink.href);
          if (!itemResponse.ok) {
            throw new Error('HTTP error: ' + itemResponse.status);
          }
          itemBody = await itemResponse.json();
        }
        switch(itemBody.p) {
          default :
            grid[currentIndex].className = isWarmup ? 'warmed' : 'received';
            break;
          case 1 :
            grid[currentIndex].className = 'pushed';
            break;
          case 2 :
            grid[currentIndex].className = 'fresh';
            break;
          case 3 :
            grid[currentIndex].className = 'compound';
            break;
        }
      } catch (err) {
        grid[currentIndex].className = 'error';
      }
    })());
    count++;

  }

  await Promise.all(promises);

  return [
    (Date.now() - time) / 1000,
    cTime / 1000
  ];

}

function setResults(test, cacheTime, time, collectionTime) {

  text('test-name', test.label);
  text('cache-time', cacheTime);
  text('collection-time', collectionTime);
  text('test-time', time);

}

function text(id, value) {

  console.log(id, value);
  document.getElementById(id).textContent = value;

}

let grid = [];

function newGrid() {

  grid = [];
  const items = document.getElementById('items');
  items.innerHTML = '';

  for(let i = 0; i < itemCount; i++ ) {

    const span = document.createElement('span');
    grid.push(span);
    items.appendChild(span);

  }

}

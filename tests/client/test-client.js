document.addEventListener("DOMContentLoaded", main);

const itemCount = 500;

const http1Url = 'https://localhost:8082';
const http2Url = 'https://localhost:8083';

const tests = [
  {
    id: 1,
    label: 'h1, no cache, compound',
    endPoint: http1Url + '/compound',
  },
  {
    id: 2,
    label: 'h1, no cache',
    endPoint: http1Url + '/collection',
  },
  {
    id: 2,
    label: 'h1, 90% cache',
    endPoint: http1Url + '/cached',
    cached: true,
  },
  {
    id: 4,
    label: 'h2, no cache, compound',
    endPoint: http2Url + '/compound',
  },
  {
    id: 5,
    label: 'h2, no cache',
    endPoint: http2Url + '/collection',
  },
  {
    id: 6,
    label: 'h2, 80% cached, must-revalidate',
    endPoint: http2Url + '/cached2',
    cached: true,
  },
  {
    id: 7,
    label: 'h2, 80% cached',
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

  const ketting = new Ketting.Ketting(test.endPoint + '?count=' + itemCount + '&cacheBuster=' + randomId);

  const time = Date.now();

  const cTimeStart = Date.now();

  const collection = ketting.go();
  let itemResources;

  if (test.push) {
    itemResources = await collection.followAll('item').preferPush();
  } else {
    itemResources = await collection.followAll('item');
  }
 
  const cTime = Date.now()-cTimeStart;

  const promises = [];

  let count = 0;
  for(const itemResource of itemResources) {

    const currentIndex = count;

    promises.push((async () => {
      try {
        const body = await itemResource.get();
        switch(body.p) {
          default :
            grid[currentIndex].className = 'received';
            break;
          case 1 :
            grid[currentIndex].className = 'pushed';
            break;
          case 2 :
            grid[currentIndex].className = 'fresh';
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
    cTime
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

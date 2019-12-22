

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

function mainPretty() {

  updateHVersion();
  populateNav();
  newGrid();

  console.log(
`To run a test many times without graphics, use the runMany function in the console

runMany takes 2 arguments: the test id and the number of iterations');

Example:
  runMany(3, 50)
`);

}
function mainUgly() {

  const htmlConsole = document.getElementById('console');
  const realLog = console.log;

  htmlConsole.value = '';
  console.log = function(...args) {

    htmlConsole.value += args.join(' ') + '\n';
    realLog.apply(this, args);

  }

  updateHVersion(true);
  populateNav(true);

  console.log(
`To run a test many times without graphics, use the runMany function in the console

runMany takes 2 arguments: the test id and the number of iterations');

Example:
  runMany(3, 50)
`);

}

async function runMany(testId, iterations) {

  const test = tests.find( test => test.id === testId || test.label === testId );

  if (!test) {
    console.error(`Test with id ${testId} not found`);
    return;
  }

  console.log(`Test: ${test.id} - ${test.label}`);
  console.log('Iterations::', iterations);

  const results = [];

  await delay(500);

  for(var i=0; i < iterations; i++) {
    console.log('Iteration', i);

    const time = await startTest(test, true);
    console.log(time);

    results.push(time);

    // Waiting a half a second between tests
    await delay(500);

  }

  console.log(`Results for test ${test.id} - ${test.label}`);

  let sum = 0;
  let min = Infinity;
  let max = 0;
  let median;

  console.log(`csv start\n`);

  for(const result of results) {
    console.log([`"${test.label}"`,itemCount,result].join(','));
  }

  results.sort();
  for(const result of results) {
    sum+=result;
    if (result < min) min = result;
    if (result > max) max = result;
  }

  if (results.length % 2 === 0) {
    median = (results[results.length/2] + results[results.length/2-1]) / 2;
  } else {
    median = results[(results.length-1)/2]
  }

  console.log(`Total runtime: ${sum}s`);
  console.log(`Average: ${sum/results.length}s`);
  console.log(`Median: ${median}s`);
  console.log(`Min: ${min}s`);
  console.log(`Max: ${max}s`);

}


function updateHVersion(uglyVersion = false) {

  let hver, otherver, otherlink;
  if (document.location.href.startsWith(http1Url)) {
    hver = '1.1';
    otherver = '2';
    otherlink = http2Url;
  } else {
    hver = '2';
    otherver = '1.1';
    otherlink = http1Url;
  }
  text('hversion', hver);
  text('otherversion', otherver);
  document.getElementById('othertests').href = otherlink + '/' + (uglyVersion ? 'ugly' : '');

}

function populateNav(uglyVersion = false) {

  const nav = document.getElementsByTagName('nav')[0];
  for(const test of tests) {

    if (!test.endPoint.startsWith(document.location.origin)) {
      continue;
    }
    const btn = document.createElement('button');
    if (uglyVersion) {
      btn.addEventListener('click', () => runMany(test.id,50) );
    } else {
      btn.addEventListener('click', () => startTest(test) );
    }
    btn.textContent = test.id + ': ' + test.label;
    nav.appendChild(btn);

  }

}

function delay(ms) {

  return new Promise(res => {

    window.setTimeout( res, ms );

  });

}

async function startTest(test, quiet = false) {

  if (!quiet) setResults(test, '');

  const randomId = Math.random();

  if (!quiet) newGrid();

  let warmTime = 0;
  if (test.cached) {
    [warmTime] = await run(test, randomId, true, quiet);
    if (!quiet) setResults(test, warmTime + 's', 'wait');
    await delay(100);
  }

  const [time, collectionTime] = await run(test, randomId, false, quiet);

  if (!quiet) setResults(test, warmTime + 's', time + 's',collectionTime + 's');

  return time;

}

async function run(test, randomId, isWarmup = false, quiet = false) {

  if (!quiet) text('test-title', test.label);

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
        if (!quiet) switch(itemBody.p) {
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
        if (quiet) {
          throw new Error('Some request errored!');
        } else {
          grid[currentIndex].className = 'error';
        }
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

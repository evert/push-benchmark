document.addEventListener('DOMContentLoaded', main);

const testData = {

  'h1-nocache': {
    httpVersion: '1.1'
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

  renderTemplate(elem);
  renderGrid(elem.getElementByClassName('blocks'));

}

function renderTemplate(elem)  {

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

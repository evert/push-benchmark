document.addEventListener('DOMContentLoaded', main);

function main() {

  const containers = document.getElementsByClassName('parafake');
  for(const container of containers) {

    loadTestSample(container, container.dataset.id);

  }

}

const gridSize = 200;

function loadTestSample(elem, id) {

  renderGrid(elem);

}


function renderGrid(elem) {
  const grid = [];
  items.innerHTML = '';

  for(let i = 0; i < gridSize; i++ ) {

    const span = document.createElement('span');
    grid.push(span);
    elem.appendChild(span);

  }

  return grid;
}

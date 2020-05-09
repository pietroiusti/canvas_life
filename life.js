"use strict";

class Grid {
  constructor(width, height, cells) {
    this.width = width;
    this.height = height;
    this.cells = cells;
  }
  static empty(width, height, color) {
    let cells = new Array(width * height).fill(color);
    return new Grid(width, height, cells);
  }
  static random(width, height, color1, color2) {
    let cells = new Array(width * height).fill(color1);
    for (let i = 0; i < (width*height); i++) {
      if (Math.random() > 0.7) {
    	cells[i] = color2;
      }
    }
    return new Grid(width, height, cells);
  }
  cell(x, y) {
    return this.cells[x + y * this.width];
  }
  draw(cells) {
    let copy = this.cells.slice();
    for (let {x, y, color} of cells) {
      copy[x + y * this.width] = color;
    }
    return new Grid(this.width, this.height, copy);
  }
}

function updateState(state, action) {
  return Object.assign({}, state, action);
}

function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
}

const scale = 12;

class GridCanvas {
  constructor(grid, pointerDown) {
    this.dom = elt("canvas", {
      onmousedown: event => this.mouse(event, pointerDown),
      ontouchstart: event => this.touch(event, pointerDown)
    });
    this.syncState(grid);
  }
  syncState(grid) {
    if (this.grid == grid) return;
    this.grid = grid;
    drawGrid(this.grid, this.dom, scale);
  }
}

function drawGrid(grid, canvas, scale) {
  canvas.width = grid.width * scale;
  canvas.height = grid.height * scale;
  let cx = canvas.getContext("2d");

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      cx.fillStyle = grid.cell(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

GridCanvas.prototype.mouse = function(downEvent, onDown) {
  if (downEvent.button != 0) return;
  let pos = pointerPosition(downEvent, this.dom);
  let onMove = onDown(pos);
  if (!onMove) return;
  let move = moveEvent => {
    if (moveEvent.buttons == 0) {
      this.dom.removeEventListener("mousemove", move);
    } else {
      let newPos = pointerPosition(moveEvent, this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    }
  };
  this.dom.addEventListener("mousemove", move);
};

function pointerPosition(pos, domNode) {
  let rect = domNode.getBoundingClientRect();
  return {x: Math.floor((pos.clientX - rect.left) / scale),
          y: Math.floor((pos.clientY - rect.top) / scale)};
}

GridCanvas.prototype.touch = function(startEvent,
                                         onDown) {
  let pos = pointerPosition(startEvent.touches[0], this.dom);
  let onMove = onDown(pos);
  startEvent.preventDefault();
  if (!onMove) return;
  let move = moveEvent => {
    let newPos = pointerPosition(moveEvent.touches[0],
                                 this.dom);
    if (newPos.x == pos.x && newPos.y == pos.y) return;
    pos = newPos;
    onMove(newPos);
  };
  let end = () => {
    this.dom.removeEventListener("touchmove", move);
    this.dom.removeEventListener("touchend", end);
  };
  this.dom.addEventListener("touchmove", move);
  this.dom.addEventListener("touchend", end);
};

class GridEditor {
  constructor(state, config) {
    let {tools, controls, dispatch} = config;
    this.state = state;

    this.canvas = new GridCanvas(state.grid, pos => {
      let tool = tools[this.state.tool];
      let onMove = tool(pos, this.state, dispatch);
      if (onMove) return pos => onMove(pos, this.state);
    });
    this.controls = controls.map(
      Control => new Control(state, config));
    this.dom = elt("div", {id: "gridEditor"}, this.canvas.dom, elt("br"),
		   elt("div", {id: "controls"}, ...this.controls.reduce(
                     (a, c) => a.concat(" ", c.dom), [])));
  }
  syncState(state) {
    this.state = state;
    this.canvas.syncState(state.grid);
    for (let ctrl of this.controls) ctrl.syncState(state);
  }
}

function draw(pos, state, dispatch) {
  function drawCell({x, y}, state) {
    let drawn = {x, y, color: state.color};
    dispatch({grid: state.grid.draw([drawn])});
  }
  drawCell(pos, state);
  return drawCell;
}

let autoInterval; // it should always be 1 or undefined
class startButton {
  constructor(state, { dispatch }) {
    this.grid = state.grid;
    this.dom = elt("button", {
      className: "button",
      onclick: () => {
	//console.log(this.grid);
	if (!autoInterval) { // if interval it's not on (it's undefined)
          autoInterval = window.setInterval(() => {
	    let newGen = newGeneration(this.grid, "#f0f0f0", "#000000");
	    dispatch({ grid: newGen });
          }, 180);
	}
      },
    }, "Start");
  }
  syncState(state) {
    this.grid = state.grid;
  }
}

function newGeneration(grid, deadColor, aliveColor) {
  let width = grid.width, height = grid.height;
  let next = [];
  let neighborIndexes;
  let neighborValues;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let cell = x + y * width;

      if (x === 0) {
        if (y === 0) {
          neighborIndexes = [cell + 1, cell + width, cell + (width + 1)];
        } else if (y === height - 1) {
          neighborIndexes = [cell + 1, cell - (width - 1), cell - width];
        } else {
          neighborIndexes = [cell + 1, cell - (width - 1), cell + width, cell - width, cell + (width + 1)];
        }
      } else if (x === width - 1) {
        if (y === height - 1) {
          neighborIndexes = [cell - 1, cell - width, cell - (width + 1)];
        } else if (y === 0) {
          neighborIndexes = [cell - 1, cell + (width - 1), cell + width];
        } else {
          neighborIndexes = [cell - 1, cell + (width - 1), cell + width, cell - width, cell - (width + 1)];
        }
      } else if (y === height - 1) {
        neighborIndexes = [cell + 1, cell - 1, cell - (width - 1), cell - width, cell - (width + 1)];
      } else if (y === 0) {
        neighborIndexes = [cell + 1, cell - 1, cell + (width - 1), cell + width, cell + (width + 1)];
      } else {
        neighborIndexes = [cell + 1, cell - 1, cell + (width - 1), cell - (width - 1), cell + width, cell - width, cell + (width + 1), cell - (width + 1)];
      }
      neighborValues = values(grid.cells, neighborIndexes);
      next.push(updateCell(grid.cells[cell], neighborValues, deadColor, aliveColor));
    }
  }

  return new Grid(width, height, next);
}

// Take cell and array of neighbors, return updated cell.
function updateCell(cell, neighbors, deadColor, aliveColor) {
    let liveNeighbors = 0;
    for (let n of neighbors)
        if (n === aliveColor)
          liveNeighbors++;

    if (cell === aliveColor) {
        if (liveNeighbors < 2 || liveNeighbors > 3)
            return deadColor; // cell dies :(
        else if (liveNeighbors === 2 || liveNeighbors == 3)
            return aliveColor; // cell keeps surviving :)
    } else if (cell === deadColor) {
        if (liveNeighbors === 3)
            return aliveColor; // cell becomes alive :O
        else
            return deadColor;
    }
}

// Take array of values and an array of indexes of those values.
// Return array of the values of those indexes.
// Example:
// [a, b, c], [0, 2] => [a, c]
function values(array, indexes) {
    let result = [];
    for (let i = 0; i < indexes.length; i++) {
        result.push(array[indexes[i]]);
    }
    return result;
}

class stopButton {
  constructor(state, { dispatch }) {
    this.dom = elt("button", {
      className: "button",
      onclick: () => {
	window.clearInterval(autoInterval);
	autoInterval = undefined;
      },
    }, "Stop");
  }
  syncState() { }
}

class randomButton {
  constructor(state, { dispatch }) {
    this.grid = state.grid;
    this.dom = elt("button", {
      className: "button",
      onclick: () => {
	window.clearInterval(autoInterval);
	autoInterval = undefined;
	dispatch({ grid: Grid.random(this.grid.width, this.grid.height, "#f0f0f0", "#000000") });
      },
    }, "Random");
  }
  syncState(state) {
    this.grid = state.grid; 
  }
}

class clearButton {
  constructor(state, { dispatch }) {
    this.grid = state.grid;
    this.dom = elt("button", {
      className: "button",
      onclick: () => {
	window.clearInterval(autoInterval);
	autoInterval = undefined;
	dispatch({ grid:Grid.empty(this.grid.width, this.grid.height, "#f0f0f0") });
      },
    }, "Clear");
  }
  syncState() { }
}

class eraserButton {
  constructor(state, { dispatch }) {
    this.active = false;
    this.dom = elt("button", {
      className: "button",
      onclick: event => {
	this.active = this.active === false ? true : false;
	dispatch({ color: this.active === true ? "#f0f0f0" : "#000000"});
	event.target.style.background = this.active ? "red" : "";
      },
    }, "Eraser");
  }
  syncState() {}
}

class patternSelect {
  constructor(state, { dispatch }) {
    this.grid = state.grid;
    this.dom = elt("select", {id: "pattern",
			      onchange: (e) => {
				window.clearInterval(autoInterval);
				autoInterval = undefined;
				let pattern = e.target.value;
				dispatch({grid: new Grid(100, 60, patterns[pattern])});
			      }
			     },
		   elt("option", {value: "gosperGliderGun"}, "Gosper Glider Gun"),
		   elt("option", {value: "test"}, "test"));
  }
  syncState(state) {
    this.grid = state.grid;
  }
}

let startState = {
  tool: "draw",
  color: "#000000",
  grid: new Grid(100, 60, patterns.gosperGliderGun) //Grid.random(100, 60, "#f0f0f0", "#000000"),
};

let baseTools = { draw };

let baseControls = [patternSelect, startButton, stopButton, randomButton, clearButton, eraserButton];

function startGridEditor({ state = startState,
			    tools = baseTools,
			    controls = baseControls }) {
  let app = new GridEditor(state, {
    tools,
    controls,
    dispatch(action) {
      state = updateState(state, action);
      app.syncState(state);
    }
  });
  return app.dom;
}

document.querySelector("div").appendChild(startGridEditor({}));


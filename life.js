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

const scale = 30;

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
    this.dom = elt("div", {}, this.canvas.dom, elt("br"),
                   ...this.controls.reduce(
                     (a, c) => a.concat(" ", c.dom), []));
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

class startButton {
  // TODO
  constructor(state, { dispatch }) {
    this.dom = elt("button", {
      onclick: () => {
	console.log(state);
      },
    }, "Start");
  }
  syncState() { }
}

class stopButton {
  // TODO
  constructor(state, { dispatch }) {
    this.dom = elt("button", {
      onclick: () => {},
    }, "Stop");
  }
  syncState() { }}

class resetButton {
  // TODO
  constructor(state, { dispatch }) {
    this.dom = elt("button", {
      onclick: () => {},
    }, "Reset");
  }
  syncState() { }
}

class clearButton {
  // TODO
  constructor(state, { dispatch }) {
    this.dom = elt("button", {
      onclick: () => {},
    }, "Clear");
  }
  syncState() { }
}

let startState = {
  tool: "draw",
  color: "#000000",
  grid: Grid.random(60, 30, "#f0f0f0", "#000000"),
};

let baseTools = { draw };
let baseControls = [startButton, stopButton, resetButton, clearButton];
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

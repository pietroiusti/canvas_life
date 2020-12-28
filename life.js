"use strict";

(() => {

  class Grid {
    constructor(width, height, cells) {
      this.width = width;
      this.height = height;
      this.cells = cells;
    }
    static empty(width, height) {
      let cells = new Array(width * height).fill(0);
      return new Grid(width, height, cells);
    }
    cell(x, y) {
      return this.cells[x + y * this.width];
    }
    // Take an array of objects that represent the cells that are to
    // be updated. The objects have x and y properties to get the
    // position and state property to know whether the cell should be
    // made alive or dead. Create a copy of the current cells, change
    // them accordingly and return a new grid.
    draw(cells) {
      let copy = this.cells.slice();
      for (let {x, y, state} of cells) {
	copy[x + y * this.width] = state;
      }
      return new Grid(this.width, this.height, copy);
    }
  }
  
  function updateState(state, action) {
    return Object.assign({}, state, action);
  }
  
  // Create a DOM element
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
  
  // Draw grid on a canvas element (scaling)
  function drawGrid(grid, canvas, scale) {
    canvas.width = grid.width * scale;
    canvas.height = grid.height * scale;
    let cx = canvas.getContext("2d");

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
	cx.fillStyle = grid.cell(x, y) === 0 ? "#f0f0f0" : "#000000";
	cx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  GridCanvas.prototype.mouse = function(downEvent, onDown) {
    if (downEvent.button != 0) // if it's not the left button
      return;
    let pos = pointerPosition(downEvent, this.dom);
    let onMove = onDown(pos);
    if (!onMove) return;
    let move = moveEvent => {
      if (moveEvent.buttons == 0) { // if no button is being held down
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
      let drawn = { x, y, state: 1 };
      dispatch({grid: state.grid.draw([drawn])});
    }
    drawCell(pos, state);
    return drawCell;
  }

  function erase(pos, state, dispatch) {
    function drawCell({x, y}, state) {
      let drawn = { x, y, state: 0 };
      dispatch({grid: state.grid.draw([drawn])});
    }
    drawCell(pos, state);
    return drawCell;
  }

  function line(pos, state, dispatch) {
    // ``naive algorithm'' from Wikipedia:
    // dx = x2 - x1
    // dy = y2 - y1
    // for x from x1 to x2 {
    //   y = y1 + dy * (x - x1) / dx
    //   plot(x, y)
    // }
    let startPoint, endPoint;
    function drawLine({x, y}) {
      let line = [];
      if (!startPoint)
	startPoint = { x, y, state: 1 };
      else
	endPoint = { x, y, state: 1 };
      if (endPoint) {
	if (Math.abs(startPoint.x - endPoint.x) >
	    Math.abs(startPoint.y - endPoint.y)) { //horizontalish line
	  
	  if (startPoint.x > endPoint.x) {
	    // swap start and end
	    let dx = startPoint.x - endPoint.x;
	    let dy = startPoint.y - endPoint.y;
	    for (let x = endPoint.x; x <= startPoint.x; x++) {
	      let y = Math.floor(endPoint.y + dy * (x - endPoint.x) / dx);
	      line.push({x, y, state: 1});
	    }
	  }
	  else {
	    let dx = endPoint.x - startPoint.x;
	    let dy = endPoint.y - startPoint.y;
	    for (let x = startPoint.x; x <= endPoint.x; x++) {
	      let y = Math.floor(startPoint.y + dy * (x - startPoint.x) / dx);
	      line.push({x, y, state: 1});
	    }
	  }
	} else { //verticalish line
	  if (startPoint.y > endPoint.y) {
	    // swap start and end
	    let dx = startPoint.x - endPoint.x;
	    let dy = startPoint.y - endPoint.y;
	    for (let y = endPoint.y; y <= startPoint.y; y++) {
	      let x = Math.floor(endPoint.x + dx * (y - endPoint.y) / dy);
	      line.push({x, y, state: 1});
	    }
	  } else {
	    let dx = endPoint.x - startPoint.x;
	    let dy = endPoint.y - startPoint.y;
	    for (let y = startPoint.y; y <= endPoint.y; y++) {
	      let x = Math.floor(startPoint.x + dx * (y - startPoint.y) / dy);
	      line.push({x, y, state: 1});
	    }
	  }
	}
      }
      dispatch({ grid: state.grid.draw(line) });
    }
    drawLine(pos);
    return drawLine;
  }

  function rectangle(start, state, dispatch) {
    function drawRectangle(pos) {
      let xStart = Math.min(start.x, pos.x);
      let yStart = Math.min(start.y, pos.y);
      let xEnd = Math.max(start.x, pos.x);
      let yEnd = Math.max(start.y, pos.y);
      let drawn = [];
      for (let y = yStart; y <= yEnd; y++) {
	for (let x = xStart; x <= xEnd; x++) {
          drawn.push({ x, y, state: 1 });
	}
      }
      dispatch({ grid: state.grid.draw(drawn) });
    }
    drawRectangle(start);
    return drawRectangle;
  }

  function circle(start, state, dispatch) {
    function drawCircle(pos) {
      //get distance between start and current pointer (radius)
      let xStart = Math.min(start.x, pos.x);
      let yStart = Math.min(start.y, pos.y);
      let xEnd = Math.max(start.x, pos.x);
      let yEnd = Math.max(start.y, pos.y);
      let xDiff = xEnd - xStart;
      let yDiff = yEnd - yStart;
      let radius = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2));
      console.log(`distance: ${radius}`);
      let drawn = [];
      //loop over a square of pixels around the start position,
      //whose sides are at least twice the radius. Color those that
      //are withing the circle radius
      console.log(`start: x: ${xStart}, y: ${yStart}`);
      let rectStart = { x: xStart - Math.floor(radius), y: yStart - Math.floor(radius) };
      console.log(`floor(radius): ${Math.floor(radius)}`);
      console.log(`rectStart: ${rectStart.x}, ${rectStart.y}`);
      let rectEnd = { x: xStart + Math.floor(radius), y: yStart + Math.floor(radius) };
      console.log(`rectEnd: ${rectEnd.x}, ${rectEnd.y}`);
      console.log(state.grid.width);
      console.log(state.grid.height);
      for (let y = rectStart.y; y <= rectEnd.y; y++) {
	for (let x = rectStart.x; x <= rectEnd.x; x++) {
          console.log(`x: ${x}, y: ${y}`);
          if (x < state.grid.width && x > 0) {
            // get distance from current pixel to the starting pixel
            let xd = x - xStart;
            let yd = y - yStart;
            let distance = Math.sqrt(Math.pow(xd, 2) + Math.pow(yd, 2));
            // (is the distance from current pixel to the starting
            // pixel less or equal to the radius?)
            if (distance < radius) {
              // color pixel if conditions are met
              drawn.push({ x, y, state: 1 });
            }
          }
	}
      }

      dispatch({ grid: state.grid.draw(drawn) });
    }
    drawCircle(start);
    return drawCircle;
  }

  function newGeneration(grid) {
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
	next.push(updateCell(grid.cells[cell], neighborValues));
      }
    }

    return new Grid(width, height, next);
  }

  function updateCell(cell, neighbors) {
    let liveNeighbors = 0;
    for (let n of neighbors)
      if (n === 1)
        liveNeighbors++;

    if (cell === 1) {
      if (liveNeighbors < 2 || liveNeighbors > 3)
        return 0; // cell dies :(
      else if (liveNeighbors === 2 || liveNeighbors == 3)
        return 1; // cell keeps surviving :)
    } else if (cell === 0) {
      if (liveNeighbors === 3)
        return 1; // cell becomes alive :O
      else
        return 0;
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

  class StartButton {
    constructor(state, { dispatch }) {
      this.grid = state.grid;
      this.interval = state.interval;
      this.speed = state.speed;
      this.dom = elt("button", {
	className: "button",
	onclick: () => {
	  console.log(this.grid);
	  if (!this.interval) { // if interval it's not on (it's undefined)
            let autoInterval = window.setInterval(() => {
	      let newGen = newGeneration(this.grid);
	      dispatch({ grid: newGen });
            }, this.speed);
	    dispatch({ interval: autoInterval });
	  }
	},
      }, "Start");
    }
    syncState(state) {
      this.grid = state.grid;
      this.interval = state.interval;
      this.speed = state.speed;
    }
  }

  class StopButton {
    constructor(state, { dispatch }) {
      this.dom = elt("button", {
	className: "button",
	onclick: () => {
	  window.clearInterval(this.interval);
	  dispatch({ interval: undefined });
	},
      }, "Stop");
    }
    syncState(state) {
      this.interval = state.interval;
    }
  }

  class ClearButton {
    constructor(state, { dispatch }) {
      this.grid = state.grid;
      this.dom = elt("button", {
	className: "button",
	onclick: () => {
	  window.clearInterval(this.interval);
	  // dispatch({ grid:Grid.empty(this.grid.width, this.grid.height, "#f0f0f0"), interval: undefined });
	  dispatch({ grid:Grid.empty(this.grid.width, this.grid.height, 0), interval: undefined });
	},
      }, "Clear");
    }
    syncState(state) {
      this.interval = state.interval;
    }
  }

  class ToolSelect {
    constructor(state, { tools, dispatch }) {
      this.select = elt("select", {
	onchange: () => dispatch({ tool: this.select.value })
      }, ...Object.keys(tools).map(name => elt("option", {
	//selected: name == state.tool,
	value: name
      }, name[0].toUpperCase() + name.slice(1))));
      this.dom = elt("label", null, "Tool: ", this.select);
    }
    syncState(state) { this.select.value = state.tool; }
  }

  class PatternSelect {
    constructor(state, { dispatch }) {
      this.grid = state.grid;
      this.select = elt("select", {id: "pattern",
				   onchange: (e) => {
				     window.clearInterval(this.interval);
				     dispatch({ interval: undefined });
				     let pattern = e.target.value;
				     dispatch({ grid: new Grid(100, 60, patterns[pattern].cells )});
				   }
				  },
			...Object.keys(patterns).map((key, index) => elt("option", {value: key}, patterns[key].name)),
		       );
      this.dom = elt("label", null, "Pattern: ", this.select);
    }
    syncState(state) {
      this.interval = state.interval;
    }
  }

  class SpeedButtons {
    constructor(state, { dispatch }) {
      this.grid = state.grid;
      this.dom = elt("span", {},
		     elt("button", {
		       onclick: () => {
			 let speed = this.speed + 30;
			 if (this.interval) {
			   window.clearInterval(this.interval);
			   let autoInterval = window.setInterval(() => {
			     // dispatch({ grid: newGeneration(this.grid, "#f0f0f0", "#000000") });
			     dispatch({ grid: newGeneration(this.grid) });
			   }, speed);
			   dispatch({ interval: autoInterval, speed: speed });
			 } else {
			   dispatch({ speed: speed });
			 }
		       }
		     }, "-"), " ", "speed", " ",
		     elt("button", {
		       onclick: () => {
			 let speed = this.speed - 30;
			 if (this.interval) {
			   window.clearInterval(this.interval);
			   let autoInterval = window.setInterval(() => {
			     // dispatch({ grid: newGeneration(this.grid, "#f0f0f0", "#000000") });
			     dispatch({ grid: newGeneration(this.grid) });
			   }, speed);
			   dispatch({ interval: autoInterval, speed: speed });
			 } else {
			   dispatch({ speed: speed });
			 }
		       }
		     }, "+"));
    }
    syncState(state) {
      this.grid = state.grid;
      this.interval = state.interval;
      this.speed = state.speed;
    }
  }

  let startState = {
    tool: "draw",
    grid: new Grid(100, 60, patterns.gosperGliderGun.cells),
    interval: undefined,
    speed: 180,
  };

  let baseTools = { draw, erase, line, rectangle, /*circle*/ };

  let baseControls = [PatternSelect, ToolSelect, StartButton, StopButton, ClearButton, SpeedButtons];

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

  document.querySelector("#main").appendChild(startGridEditor({}));

})();

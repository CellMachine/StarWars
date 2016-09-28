var k1 = 4, k2 = 16, maxSteps = 200
var components = [],  jedis = [], statistics = []

field = new Machine({
	size: 8,
	width: 96,
	height: 64,
	container: 'container',
	colors: ['#86B404', '#F5DA81', '#81DAF5', '#FE2E2E', 'black']
})

cell = {
	vision: 1,
	process: function(n) {
		// droid's bullet is spent
		if (this.shot != null)
			this.shot = null

		switch (this.color) {
			case 1: processDroid(n, this); break
			case 2: processJedi(n, this); break
			case 3: processBullet(n, this)
		}

		// if some neighbour droid shots in my direction
		if (this.color == 0) {
			var bulletParams = set(n, function(a, me) {
				return a.shot && a.shot.ID == me.id
			}, this)
			if (bulletParams.length) {
				this.color = 3
				this.age = 0
				this.sx = this.x
				this.sy = this.y
				this.tx = bulletParams[0].shot.x
				this.ty = bulletParams[0].shot.y
			}
		}
	},
	move: function(n) {
		switch (this.color) {
			case 1: return moveDroid(n, this)
			case 2: return moveJedi(n, this)
			case 3: return moveBullet(n, this)
		}
	}
}

field.init([
	[cell, 1, { color: 0 }]
])

// if mouse is pressed now it is true, otherwise it's false
mousedown = false

/**
* register mouse pressed
*/
document.body.onmousedown = function() {
	mousedown = true
}

/**
* register mouse released
*/
document.body.onmouseup = function() {
	mousedown = false
}

// the default brush is 'grass'
setBrush(0)

/**
* Sets the current type to draw.
* @param {Integer} id - the id of new color of cell.
*/
function setBrush(id) {
	for (var i = 0; i <= 2; i++)
		document.getElementById(i).style.backgroundColor = i == id ? '#57b13b' : '#454545'

	brush = id
}

// draw if user moved pressed mouse over canvas
field.canvas.onmousemove = function(e) {
	draw(e)
}

// draw if user pressed mouse on canvas
field.canvas.onmousedown = function(e) {
	mousedown = true
	draw(e)
}

/**
* Draws on user-selected cell if mouse is pressed.
* @param {e} - the client argument cantaining x- and y-coordinates of user mouse
*/
function draw(e) {
	var x = Math.floor((e.clientX - field.canvas.offsetLeft) / field.size), y = Math.floor((e.clientY - field.canvas.offsetTop) / field.size)
	var pixel = field.grid[y * field.width + x]
	if (pixel && mousedown) pixel.color = brush
	field.visualize()
}

/**
* Starts the battle simulation.
*/
function start() {
	field.canvas.onmousedown = function() {}
	field.canvas.onmousemove = function() {}
	field.start(50, after)
	document.getElementById('control').innerHTML = 'Stop'
	document.getElementById('control').style.backgroundColor = '#57b13b'
	document.getElementById('control').onclick = stop
}

/**
* Stops the battle simulation.
*/
function stop() {
	document.getElementById('control').onclick = function() {}
	field.stop()
	showStatistics()
}

// how many iterations done 
var steps = 0

/**
* After every step whe should find all droid groups and jedis.
*/
function after() {
	steps++

	var droidsAmount = 0

	components = []
	var colors = new Array(field.grid.length)
	for (var i = 0; i < colors.length; i++) colors[i] = 0
	// 0 is white, 1 is gray, 2 is black
	for (var i = 0; i < field.grid.length; i++)
		if (field.grid[i].color == 1)
			if (colors[i] == 0) {
				var center = dfs(colors, i)
				components.push({ x: Math.round(center.x / center.k), y: Math.round(center.y / center.k) })
				droidsAmount += center.k
			}

	jedis = []
	for (var i = 0; i < field.grid.length; i++)
		if (field.grid[i].color == 2)
			jedis.push({ x: field.grid[i].x, y: field.grid[i].y })

	if (!(steps % 10))
		statistics.push({ jedis: jedis.length, droids: droidsAmount })
}

/**
* This function describes the droid behavior.
* @param {Array} n - the neighbours of the droid
* @param {Object} me - the droid itself
*/
function processDroid(n, me) {
	// jedi destroys droid
	var jedi = set(n, { color: 2 }).length
	if (jedi)
		me.color = 0

	var mx = me.x, my = me.y

	// shoot to nearest jedi
	me.shots = []
	var minJediDistance = 10e9
	for (var i = 0; i < jedis.length; i++) {
		var J = jedis[i]
		if (distance(mx, my, J.x, J.y) <= k2 && Math.random() > 0.9 && set(n, { color: 0 }).length) {
			me.minDist = 10e9
			jx = J.x
			jy = J.y
			var shotId = set(n, function(a, me) {
				var d = distance(a.x, a.y, jx, jy)
				if (d <= me.minDist && a.color == 0) {
					me.minDist = d
					return true
				} else
					return false
			}, me).rand().id

			var deltaX = J.x - field.grid[shotId].x, deltaY = J.y - field.grid[shotId].y
			var scope = deltaY / deltaX
			var flag = true
			field.grid.forEach(function(cell) {
				if (cell.id != me.id && distance(cell.x, cell.y, me.x, me.y) <= 5 && cell.color == 1) {
					if (!deltaX || !deltaY) {
						if (!deltaX && ((cell.y > field.grid[shotId].y && deltaY > 0) || (cell.y < field.grid[shotId].y && deltaY < 0)))
							flag = false
						else if (!deltaY && ((cell.x > field.grid[shotId].x && deltaX > 0) || (cell.x < field.grid[shotId].x && deltaX < 0)))
							flag = false
					} else if ((deltaX > 0 && cell.x - field.grid[shotId].x > 0) || (deltaX < 0 && cell.x - field.grid[shotId].x < 0)) {
						if ((Math.abs(scope) >= 1) && (cell.x == (field.grid[shotId].x + Math.round((cell.y - field.grid[shotId].y) / scope))))
							flag = false
						else if ((Math.abs(scope) < 1) && (cell.y == (field.grid[shotId].y + Math.round((cell.x - field.grid[shotId].x) * scope))))
							flag = false
					}
				}
			})

			if (flag) {
				var jediDistance = distance(J.x, J.y, field.grid[shotId].x, field.grid[shotId].y)
				if (jediDistance < minJediDistance) {
					me.shots = [{ ID: shotId, x: J.x, y: J.y }]
					minJediDistance = jediDistance
				} else if (jediDistance == minJediDistance) {
					me.shots.push({ ID: shotId, x: J.x, y: J.y })
				}
			}
		}
	}

	if (me.shots.length)
		me.shot = me.shots.rand()
	else
		me.shot = { ID: -1 }

	// select motion to the group
	if (set(n, { color: 1 }).length < 3) {
		var minDist = 1e9
		var variants = []
		components.forEach(function(cmp) {
			if (cmp.x != me.x && cmp.y != me.y) {
				var dist = distance(me.x, me.y, cmp.x, cmp.y)
				if (dist < minDist) {
					variants = [cmp]
					minDist = dist
				} else if (dist == minDist)
					variants.push(cmp)
			}
		})
		if (variants.length) {
			var cmp = variants.rand()
			me.sx = me.x
			me.sy = me.y
			me.tx = cmp.x
			me.ty = cmp.y
		}
	} else me.tx = -1
}

/**
* This function describes the jedi behavior.
* @param {Array} n - the neighbours of the jedi
* @param {Object} me - the jedi itself
*/
function processJedi(n, me) {
	var mx = me.x, my = me.y

	if (me.tx == null)
		me.tx = -1

	if (me.tx == -1 && components.length) {
		var s2 = 9999
		var attack
		components.forEach(function(cmp) {
			var s1 = Math.sqrt(Math.pow((cmp.x - mx), 2) + Math.pow((cmp.y - my), 2))
			if (s1 < s2) {
				attack = cmp
				s2 = s1
			}
		})
		me.sx = me.x
		me.sy = me.y
		me.tx = attack.x
		me.ty = attack.y
	} else if (me.tx > -1 && me.x == me.tx && me.y == me.ty) {
		me.tx = -1
	}

	if (set(n, { color: 3 }).length > k1)
		me.color = 0
}

/**
* This function describes the bullet behavior.
* @param {Array} n - the neighbours of the bullet
* @param {Object} me - the bullet itself
*/
function processBullet(n, me) {
	me.age++
	if (me.age > 32)
		me.color = 0
}

/**
* Droid movement.
* @param {Array} n - the neighbours of droid
* @param {Object} me - droid itself
* @typedef {Object|boolean} Point
* @property {number} x - The new X Coordinate
* @property {number} y - The new Y Coordinate
* @property {Object} instead - Free place
* @property {number} priority - The priority when more then one
* objects are going to move to the same cell
*/
function moveDroid(n, me) {
	if (me.tx > -1) 
		return moveToTarget(n, me, 0, { color: 1 })
}

/**
* Jedi movement.
* @param {Array} n - the neighbours of jedi
* @param {Object} me - jedi itself
* @typedef {Object|boolean} Point
* @property {number} x - The new X Coordinate
* @property {number} y - The new Y Coordinate
* @property {Object} instead - Free place
* @property {number} priority - The priority when more then one
* objects are going to move to the same cell
*/
function moveJedi(n, me) {
	var path = weight(n, me.x, me.y)
	if (path)
		path = path.rand()
	if (path && path.k > 0) {
		me.tx = -1
		var flag = true
		n.forEach(function(cell) {
			if (cell.x == path.x && cell.y == path.y && cell.color == 2)
				flag = false
		})
		if (flag)
			return { x: path.x, y: path.y, instead: { color: 0 }, priority: 1 }
	} else if (me.tx > -1)
		return moveToTarget(n, me, 2, { color: 2 })
}

/**
* Bullet movement.
* @param {Array} n - the neighbours of bullet
* @param {Object} me - bullet itself
* @typedef {Object|boolean} Point
* @property {number} x - The new X Coordinate
* @property {number} y - The new Y Coordinate
* @property {Object} instead - Free place
* @property {number} priority - The priority when more then one
* objects are going to move to the same cell
*/
function moveBullet(n, me) {
	return moveToTarget(n, me, 1, {})
}

/**
* The recursive DFS search for finding all the independent droid groups.
* @param {Array} colors - which droids were used
* @param {Integer} v - ID of droid
* @returns {Object} Sum of x- and y-coordinates of all connected droids and
* the number of droids for calculation of arithmetical mean of positions.
*/
function dfs(colors, v) {
	colors[v] = 1
	var x = field.grid[v].x, y = field.grid[v].y, k = 1
	for (var i = 0; i < field.grid[v].n.length; i++)
		if (field.grid[field.grid[v].n[i]].color == 1 && colors[field.grid[v].n[i]] == 0) {
			var newPos = dfs(colors, field.grid[v].n[i])
			x += newPos.x
			y += newPos.y
			k += newPos.k
		}
	colors[v] = 2
	return { x: x, y: y, k: k }
}

/**
* Cells with the most amount of near droids for jedi moving.
* @param {Array} n - neighbour cells of the jedi
* @param {Integer} x - x-coordinate of jedi
* @param {Integer} y - y-coordinate of jedi
* @typedef {Object} Point
* @property {Integer} x - The x-coordinate of the calculated cell
* @property {Integer} y - The y-coordinate of the calculated cell
* @property {Integer} k - The total weight of the calculated cell
*/
function weight(n, x, y) {
	var koefs = new Array(8)
	for (var i = 0; i < 8; i++) koefs[i] = -1
	var poses =
	[
		[x - 1, y - 1, 0], [x, y - 1, 1], [x + 1, y - 1, 2],
	  	[x - 1, y, 7], [x + 1, y, 3],
      	[x - 1, y + 1, 6], [x, y + 1, 5], [x + 1, y + 1, 4]
	]
	for (var i = 0; i < n.length; i++)
		poses.forEach(function(XY) {
			initKoef(koefs, n[i], XY)
		})
	var totalKoefs = new Array(8)
	for (var i = 0; i < 8; i++)
		totalKoefs[i] = ctk(koefs, i)
	
	var max = { k: -1 }
	var bests = []
	for (var i = 0; i < 8; i++)
		if (totalKoefs[i].k > max.k) {
			max = totalKoefs[i]
			bests = [max]
		} else if (totalKoefs[i].k == max.k) {
			bests.push(totalKoefs[i])
		}
	if (max.k > -1)
		return bests
	return false
}

/**
* Initial weight of the cell.
* @param {Array} colors - which droids were used
* @param {Integer} v - ID of droid
* @returns {Object} Sum of x- and y-coordinates of all connected droids and
* the number of droids for calculation of arithmetical mean of positions.
*/
function initKoef(koefs, a, XY) {
	if (a.x == XY[0] && a.y == XY[1] )
		if (a.color == 0 || a.color == 1)
			koefs[XY[2]] = { x: XY[0], y: XY[1], k: a.color }
}

/**
* Total weight of the cell.
* @param {Array} koefs - initial koefficients to be used for calculation of total
* @param {Integer} i - index of the calculated koefficient 
* @typedef {Object}
* @property {Integer} x - The x-coordinate of the calculated cell
* @property {Integer} y - The y-coordinate of the calculated cell
* @property {Integer} k - The total weight of the calculated cell
*/
function ctk(koefs, i) {
	if (koefs[i].k == -1)
		return { k: -1 }
	else {
		var result = 0

		var limit = 4, j = i + 1
		while (limit > 0) {
			if (j == 0)
				j = 7
			else
				j--
			if (koefs[j].k == 1)
				result += limit + 1
			limit--
		}
		limit = 4
		j = i
		while (limit > 0) {
			if (j == 7)
				j = 0
			else
				j++
			if (koefs[j].k == 1)
				result += limit
			limit--
		}
		return { x: koefs[i].x, y: koefs[i].y, k: result }
	}
}

/**
* The absolute distance between two points via Pythagorean theorem.
* @param {Integer} x1 - x-coordinate of the first point
* @param {Integer} y1 - y-coordinate of the first point
* @param {Integer} x2 - x-coordinate of the second point
* @param {Integer} y2 - y-coordinate of the second point
* @returns {Float} The absolute distance between points
*/
function distance(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
}

/**
* Next position of object when it moves to the target via linear function.
* @param {Array} n - neighbours
* @param {Cell} me - processing cell
* @param {Integer} priority - priority of the cell when it moves
* @param {Object} ban - if cell where object want to move has banned parameters,
* object will not move to it
* @typedef {Object} moving parameters
* @property {Integer} x - new x-coordinate
* @property {Integer} y - new y-coordinate
* @property {Object} instead - free the cell <=> change its color to '0'
* @property {Integer} priority - priority of object if more then one objects want
* to move to the same cell  
*/
function moveToTarget(n, me, priority, ban) {
	var newX = me.x, newY = me.y
	var deltaX = me.tx - me.sx, deltaY = me.ty - me.sy
	var scope = deltaY / deltaX

	if ((deltaX == 0) || (deltaY == 0)) {
		newX = me.x + (deltaX == 0 ? 0 : deltaX / Math.abs(deltaX))
		newY = me.y + (deltaY == 0 ? 0 : deltaY / Math.abs(deltaY))
	} else {
		if (Math.abs(scope) >= 1) {
			newY = me.y + deltaY / Math.abs(deltaY)
			newX = me.sx + Math.round((newY - me.sy) / (scope))
		} else {
			newX = me.x + deltaX / Math.abs(deltaX)
			newY = me.sy + Math.round((newX - me.sx) * (scope))
		}
	}

	if (!set(n, { x: newX, y: newY }).length) {
		me.color = 0
		return false
	}
	
	var newCell = set(n, { x: newX, y: newY })[0]
	for (var key in ban)
		if (newCell[key] == ban[key])
			return false
		
	return { x: newX, y: newY, instead: { color: 0 }, priority: priority }
}

/**
* Draws droids and jedis populations chart
*/
function showStatistics() {
	var ctx = document.getElementById('chart')
	var ctx1 = document.getElementById('chart1')

	var labels = [], droidData = [], jediData = []
	for (var i = 0; i < statistics.length; i++) {
		labels.push((i + 1) * 10)
		droidData.push(statistics[i].droids)
		jediData.push(statistics[i].jedis)
	}

	new Chart(ctx, {
	    type: 'line',
	    data: {
	        labels: labels,
	        datasets: [{
	        	label: 'droids',
	            data: droidData,
	            borderColor: [
	                '#F5DA81'
	            ],
	            backgroundColor: [
	            	'rgba(245, 218, 129, 0.1)'
	            ],
	            borderWidth: 1
	        }]
	    },
	    options: {
	        scales: {
	            yAxes: [{
	                ticks: {
	                    beginAtZero:true
	                }
	            }]
	        }
	    }
	})

	new Chart(ctx1, {
	    type: 'line',
	    data: {
	        labels: labels,
	        datasets: [{
	        	label: 'jedis',
	            data: jediData,
	            borderColor: [
	                '#81DAF5'
	            ],
	            backgroundColor: [
	           	 	'rgba(129, 218, 245, 0.1)'
	            ],
	            borderWidth: 1
	        }]
	    },
	    options: {
	        scales: {
	            yAxes: [{
	                ticks: {
	                    beginAtZero:true
	                }
	            }]
	        }
	    }
	})
}
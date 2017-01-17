function Board() {

    this.cells = []   
    this.solutionMode = false 
    this.solver = new Solver(this)

    this.clear = function() {
        this.solutionMode = false
        this.solver = new Solver(this)
        for(var x = 0; x<9; x++) {
            this.cells[x] = []
            for(var y = 0; y<9; y++) {
                this.cells[x][y] = new Cell(x, y)
            }
        }
    }

    this.clear()

    this.draw = function() {
        if(this.solutionMode && !this.solver.finished) {
            this.solver.progress()
        }

        for(var x = 0; x<9; x++) {            
            for(var y = 0; y<9; y++) {
                this.cells[x][y].valid = this.isValid(x, y)
                this.cells[x][y].draw()
            }
        }   
        push()
        strokeWeight(4)        
        stroke(0)
        for(var i = 0; i<=3; i++) {
            line(3 * CELL_SIZE * i, 0, 3 * CELL_SIZE * i, height)
            line(0, 3 * CELL_SIZE * i, width, 3 * CELL_SIZE * i)
        }
        pop()
    }

    this.build = function() {
        var startX = Math.floor(random(0, 9))
        var startY = Math.floor(random(0, 9))
        this.cells[startX][startY].val = Math.floor(random(1, 9))
        var n = this.next(startX, startY)
        this.buildRec(n[0], n[1], startX, startY)
        for(var x = 0; x<9; x++) {
            for(var y = 0; y<9; y++) {
                if(random() <= DIFFICULTY) {
                    this.cells[x][y].val = undefined
                    this.cells[x][y].fixed = false
                }
            }
        }
    }

    this.buildRec = function(x, y, startX, startY) {        
        for(var i = 1; i<= 9; i++) {
            this.cells[x][y].val = i
            this.cells[x][y].fixed = true
            if(this.isValid(x, y)) {
                var n = this.next(x, y)
                if(n[0] === startX && n[1] === startY) {
                    return true
                }
                if(this.buildRec(n[0], n[1], startX, startY)) {
                    return true
                }
            }                    
        }

        this.cells[x][y].val = undefined
        return false  
    }

    this.next = function(x, y) {
        if(x === 8 && y === 8) {
            return [0, 0]
        }

        if(x + 1 > 8) {
            return [0, y + 1]
        }

        return [x + 1, y]
    }

    this.isValid = function(x, y) {
        for(var i = 0; i<9; i++) {
            if(i == y) continue 
            if(this.cells[x][i].val === this.cells[x][y].val) {
                return false
            }
        }

        for(i = 0; i< 9; i++) {
            if(i === x) continue
            if(this.cells[i][y].val === this.cells[x][y].val) {
                return false
            }
        }
        
        var row = Math.floor(x / 3) * 3
        var col = Math.floor(y / 3) * 3        
        for(var i = 0; i< 3; i++) {
            for(var j = 0; j< 3; j++) {
                var r = i + row
                var c = j + col        
                if(r === x && c === y) continue                
                if(this.cells[r][c].val === this.cells[x][y].val) {
                    return false
                }
            }
        }

        return true
    }

    this.click = function() {
        for(var x = 0; x<9; x++) {
            for(var y = 0; y<9; y++) {
                if(!this.cells[x][y].fixed) {
                    this.cells[x][y].click()
                }
            }
        }
    }

    this.keyTyped = function() {
        for(var x = 0; x<9; x++) {
            for(var y = 0; y<9; y++) {
                if(this.cells[x][y].selected) {
                    if(key >= '1' && key <= '9') {
                        this.cells[x][y].val = Number(key)                        
                    }
                }                
            }
        }
    }

    this.solve = function() {
        this.solutionMode = true
    }
}
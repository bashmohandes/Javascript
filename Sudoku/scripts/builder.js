function Builder(board) {
    this.board = board

    this.build = function() {
        var startX = Math.floor(random(0, 9))
        var startY = Math.floor(random(0, 9))
        this.board.cells[startX][startY].val = Math.floor(random(1, 9))
        var n = this.board.next(startX, startY)
        this.buildRec(n[0], n[1], startX, startY)
        for(var x = 0; x<9; x++) {
            for(var y = 0; y<9; y++) {
                if(random() <= DIFFICULTY) {
                    this.board.cells[x][y].val = undefined
                    this.board.cells[x][y].fixed = false
                }
            }
        }
    }

    this.buildRec = function(x, y, startX, startY) {        
        for(var i = 1; i<= 9; i++) {
            this.board.cells[x][y].val = i
            this.board.cells[x][y].fixed = true
            if(this.board.isValid(x, y)) {
                var n = this.board.next(x, y)
                if(n[0] === startX && n[1] === startY) {
                    return true
                }
                if(this.buildRec(n[0], n[1], startX, startY)) {
                    return true
                }
            }                    
        }

        this.board.cells[x][y].val = undefined
        return false  
    }
}
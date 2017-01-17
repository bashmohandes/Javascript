function Solver(board) {
    this.board = board
    var stack = []

    function State(x, y, val) {
        this.x = x
        this.y = y
        this.val =  val
    }

    this.x = 0
    this.y = 0
    this.val = 1

    this.finished = false

    this.progress = function() {
        var isValid = false
        if(!this.board.cells[this.x][this.y].fixed) {                                
            this.board.cells[this.x][this.y].val = this.val
            if(this.board.isValid(this.x, this.y)) {
                isValid = true
                stack.push(new State(this.x, this.y, this.val)) 
                this.val = 1               
            } else {                
                if(this.val + 1 <= 9) {
                    this.val ++
                    return
                } else {
                    this.board.cells[this.x][this.y].val = undefined
                    while(stack.length > 0) {
                        var prevState = stack.pop()
                        this.x = prevState.x
                        this.y = prevState.y
                        this.val = prevState.val + 1 > 9 ? undefined : prevState.val + 1
                        return;
                    }
                }    
            }
        }        
        if(this.board.cells[this.x][this.y].fixed || isValid) {
            var n = this.board.next(this.x, this.y)
            this.x = n[0]
            this.y = n[1]
            this.finished = (this.x === 0 && this.y === 0)
        } else  {
            this.board.cells[this.x][this.y].val = undefined
        }
    }
}
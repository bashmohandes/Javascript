function Cell(x, y, val, fixed) {
    this.x = x
    this.y = y
    this.val = val
    this.fixed = fixed
    

    this.draw = function() {
        push()
        translate(this.x * CELL_SIZE, this.y * CELL_SIZE)        
        stroke(0)
        textAlign(CENTER)
        textSize(20)
        if(this.val) {
            fill(0)
            text(this.val, CELL_SIZE / 2, CELL_SIZE / 2 + 10)
        }
        noFill()
        rect(0, 0, CELL_SIZE, CELL_SIZE)
        pop()
    }
}
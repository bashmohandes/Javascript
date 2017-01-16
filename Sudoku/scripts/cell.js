function Cell(x, y) {
    this.x = x
    this.y = y
    this.val = undefined
    this.fixed = true
    this.selected = false
    

    this.draw = function() {
        push()
        translate(this.x * CELL_SIZE, this.y * CELL_SIZE)        
        stroke(0)
        if(this.selected) {
            fill('GREY')
        } else {
            noFill()
        }
        rect(0, 0, CELL_SIZE, CELL_SIZE)        
        textAlign(CENTER)
        textSize(this.fixed ? 20 : 40)
        if(this.val) {
            if(this.fixed) {
                fill(0)
            } else {
                fill('BLUE')
            }
            text(this.val, CELL_SIZE / 2, CELL_SIZE / 2 + (this.fixed ? 10 : 15))
        }        
        pop()
    }

    this.click = function() {
        if(floor(mouseX / CELL_SIZE) === this.x && floor(mouseY / CELL_SIZE) === this.y){
            this.selected = !this.selected;
        } else {
            this.selected = false
        }

        return this.selected;
    }
}
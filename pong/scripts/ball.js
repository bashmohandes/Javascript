function Ball() {    
    this.vel = p5.Vector.random2D()
    this.vel.mult(5)
    console.log(this.heading)    
    this.pos = createVector(width / 2, height / 2)
    this.r = 50

    this.draw = function () {
        push()
        fill('WHITE')
        stroke('BLACK')
        ellipse(this.pos.x, this.pos.y, this.r, this.r)
        pop()
    }

    this.update = function () {        
        this.pos.add(this.vel)

        if((this.pos.y >= height - this.r / 2) || (this.pos.y <= this.r / 2)) {
            this.hit("Y")
        }

        if((this.pos.x >= width - this.r / 2) || (this.pos.x <= this.r / 2)) {            
            this.hit("X")
        }        
    }

    this.hit = function(axis) {
        if(axis === "Y") {
            this.vel.y *= -1
        } else if(axis === "X") {
            this.vel.x *= -1
        }
    }
}
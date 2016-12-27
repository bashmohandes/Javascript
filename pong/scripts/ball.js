function Ball() {        
    this.r = 20
    this.vel = p5.Vector.random2D()
    this.pos = createVector(width / 2, height / 2)
    this.vel.mult(10)
    this.draw = function () {
        push()
        fill('WHITE')
        stroke('BLACK')
        rect(this.pos.x, this.pos.y, this.r, this.r)
        pop()
    }

    this.update = function (player1, player2) {        
        this.pos.add(this.vel)

        if((this.pos.y >= height - this.r / 2) || (this.pos.y <= this.r / 2)) {
            this.hit("Y")
        }

        if(this.pos.x >= width - this.r / 2) {            
            player2.score ++;
            this.reset()
        } else if (this.pos.x <= this.r / 2) {
            player1.score ++;
            this.reset()
        }
        
    }

    this.hit = function(axis) {
        if(axis === "Y") {
            this.vel.y *= -1
        } else if(axis === "X") {
            this.vel.x *= -1
        }
    }

    this.reset = function() {
        this.vel = p5.Vector.random2D()
        this.pos = createVector(width / 2, height / 2)
        this.vel.mult(10)
    }    
}
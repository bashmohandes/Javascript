function Ball() {
    this.vel = p5.Vector.random2D()
    this.vel.mult(random(5, 10))
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
        this.vel.mult(0.99)
    }
}
"use strict";

function Board(pos) {
    this.pos = createVector(pos.x, pos.y)
    this.vel = createVector(0, 0)    
    this.height = 200;
    this.width = 40;
    this.vel.mult(10)

    this.draw = function() {        
        push()
        stroke(0)
        fill("WHITE")
        translate(this.pos.x, this.pos.y)
        rect(0,- this.height / 2, this.width, this.height)
        pop()
    }

    this.update = function(dir) {
        this.pos.add(this.vel)
        if(this.pos.y >= height - this.height / 2) {
            this.pos.y = height - this.height / 2
        }

        if(this.pos.y <= this.height / 2) {
            this.pos.y = this.height / 2
        }
    }

    this.moveUp = function() {        
        this.vel.y = -4
    }
    
    this.moveDown = function() {        
        this.vel.y = 4
    }

    this.stopMoving = function() {
        this.vel.y = 0
    }
}
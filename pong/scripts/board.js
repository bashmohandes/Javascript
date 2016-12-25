"use strict";

function Board(pos) {
    this.pos = pos.copy()
    this.vel = createVector(0, 0)    
    this.height = 200;
    this.width = 40;

    this.draw = function() {        
        fill("WHITE")
        rect(this.pos.x, this.pos.y - this.height / 2, this.width, this.height)        
    }

    this.update = function(dir) {        
        this.pos.add(this.vel)        
    }

    this.moveUp = function() {
        var force = createVector(0, -1)
        this.vel.add(force)
    }
    
    this.moveDown = function() {
        var force = createVector(0, 1)
        this.vel.add(force)
    }

    this.stopMoving = function() {
        this.vel.y = 0
    }
}
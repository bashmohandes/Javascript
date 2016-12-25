"use strict"

var player1, player2

function setup() {
    var canvas = createCanvas(800, 800)
    background("BLACK")

    player1 = new Board(createVector(0, height / 2))
}


function draw() {
    player1.draw()
    player1.update()
}

function keyPressed() {
    if(keyCode === DOWN_ARROW) {
        player1.moveDown();
    } else if (keyCode === UP_ARROW) {
        player1.moveUp();
    }
}

function keyReleased() {
    player1.stopMoving();
}
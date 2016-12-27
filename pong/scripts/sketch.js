"use strict"

var player1, player2, ball

function setup() {
    var canvas = createCanvas(800, 800)    

    player1 = new Board(createVector(width - 40, height / 2))
    player2 = new Board(createVector(20, height / 2))    
    ball = new Ball()    
}


function draw() {        
    push()
    background("BLACK")
    player1.draw()
    player2.draw()
    ball.draw()
    ball.update(player1, player2)
    player1.update()
    player2.update()
    displayScore()
    pop()
}

function keyPressed() {
    if(keyCode === DOWN_ARROW) {
        player1.moveDown();
    } else if (keyCode === UP_ARROW) {
        player1.moveUp();
    }
    else if(key === "W") {
        player2.moveUp();
    } else if(key === "S") {
        player2.moveDown();
    }    
}

function keyReleased() {
    if(key === "W" || key === "S") {
        player2.stopMoving();
    } else if(keyCode === DOWN_ARROW || keyCode === UP_ARROW) {
        player1.stopMoving();
    }
}

function displayScore() {
    push()    
    textAlign(CENTER)
    textSize(60)
    fill("WHITE")    
    text(player1.score + " | " + player2.score, width /2, 50)
    pop()
}
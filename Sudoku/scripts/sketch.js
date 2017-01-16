
var board
var CELL_SIZE = 80

function setup() {    
    createCanvas(CELL_SIZE * 9, CELL_SIZE * 9)
    board = new Board()
    board.build()
}


function draw() {
    background(255)    
    board.draw()
}

function mouseClicked() {
    board.click()
}

function keyTyped() {
    board.keyTyped()
}
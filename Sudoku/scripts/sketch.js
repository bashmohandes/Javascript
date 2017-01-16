
var board
var CELL_SIZE = 80
var DIFFICULTY = 0.4

function setup() {    
    var canvas = createCanvas(CELL_SIZE * 9, CELL_SIZE * 9)
    canvas.parent("canvas")
    board = new Board()
    board.build()
    var btn = select("#btnGenerate")
    btn.mousePressed(function(){
        board.clear()
        board.build()
    })
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
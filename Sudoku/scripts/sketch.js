
var board
var CELL_SIZE = 80
var DIFFICULTY = 0.4
var slider 
function setup() {    
    var canvas = createCanvas(CELL_SIZE * 9, CELL_SIZE * 9)
    canvas.parent("canvas")
    board = new Board()
    board.build()    

    createSpan("Difficulty")
    slider = createSlider(0.1, 0.7, 0.4, 0.1)
    var btn = createButton("Generate")
    btn.mousePressed(function(){
        board.clear()
        board.build()
    })
}


function draw() {
    background(255)    
    DIFFICULTY = slider.value()
    board.draw()
}

function mouseClicked() {
    board.click()
}

function keyTyped() {
    board.keyTyped()
}

var board
var CELL_SIZE = 70
var DIFFICULTY = 0.4
var slider 
function setup() {    
    var canvas = createCanvas(CELL_SIZE * 9, CELL_SIZE * 9)
    canvas.parent("canvas")
    board = new Board()
    board.build()    

    createMenu()
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

function createMenu() {
    var d = createDiv("")
    var label = createSpan("Difficulty: ")
    label.parent(d)
    var easy = createSpan("Easy")
    easy.parent(d)
    slider = createSlider(0.1, 0.6, 0.4, 0.1)
    slider.parent(d)
    var hard = createSpan("Hard ")
    hard.parent(d)
    var btn = createButton("Generate")
    btn.parent(d)
    btn.mousePressed(function(){        
        board = new Board()        
        board.build()        
    })

    var btnSolve = createButton("Auto Solve")
    btnSolve.parent(d)
    btnSolve.mousePressed(function(){
        board.solve()
    })
}
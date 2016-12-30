"use strict";

var N = 15;
var tiles = [];
var tileSize = 55;
var odds = 0.2;
var totalBombs = 0;
var totalNotVisited = N * N;
var died = false;
var bombsPlaced = false;

function setup() {
    for(var x = 0; x< N; x++) {
        tiles[x] = [];
        for(var y = 0; y<N; y++) {
            tiles[x].push(new Tile(x, y, tileSize));
        }
    }

    var c = createCanvas(N * tileSize, N * tileSize)
    c.parent("canvas")
    background(0)
}

function draw(){
    drawTiles();
    checkWinOrLose();
}

function drawTiles() {
    for(var x = 0; x< N; x++) {
        for(var y = 0; y<N; y++) {
            tiles[x][y].draw();
        }
    }
}

function mouseClicked() {
    if(gameEnded()){
        return false;
    }

    for(var x = 0; x < N; x++) {
        for(var y = 0; y < N; y++) {
            if(tiles[x][y].pressed()) {
                check(x, y);
            }
        }
    }

    return false;
}

function check(x, y) {
    visit(x, y)
    
    if(!bombsPlaced) {
        placeBombs(x, y)
    }

    if(tiles[x][y].isBomb) {
        died = true;
        return;
    }

    var neighbours = getNeighbours(x, y)
    
    var nearbyBombs = checkNearbyBombs(neighbours);
    tiles[x][y].nearBombs = nearbyBombs
    if(nearbyBombs === 0) {
        for(var i = 0; i < neighbours.length; i++) {
            if(!neighbours[i].isBomb && !neighbours[i].visited) {
                check(neighbours[i].x, neighbours[i].y)
            }
        }
    }
}

function checkNearbyBombs(neighbours) {
    var bombs = 0
    for(var i = 0; i<neighbours.length; i++) {
        if(neighbours[i].isBomb) {
            bombs++;
        }
    }

    return bombs;
}

function getNeighbours(x, y) {
    var neighbours = [];
    if(x >= 1) {
        neighbours.push(tiles[x - 1][y])
        if( y >= 1) {
            neighbours.push(tiles[x - 1][y - 1])
        }
    }

    if(x <= N - 2) {
        neighbours.push(tiles[x + 1][y])
        if(y <= N - 2) {
            neighbours.push(tiles[x + 1][y + 1])
        }
    }

    if(y >= 1) {
        neighbours.push(tiles[x][y - 1])
        if(x <= N - 2){
            neighbours.push(tiles[x + 1][y - 1])
        }
    }

    if(y <= N - 2){
        neighbours.push(tiles[x][y + 1])
        if(x >= 1) {
            neighbours.push(tiles[x - 1][y + 1])
        }
    }

    return neighbours;
}

function checkWinOrLose() {    
    if(died) {
        announce("GAME OVER :(", "RED")
        return;
    }

    if(totalBombs < totalNotVisited){
        return;
    }
    
    if(won()) {
        announce("You WIN :)", "Green")
    }
}

function won() {
    return totalBombs === totalNotVisited;
}

function gameEnded() {
    return won() || died;
}

function placeBombs(exceptX, exceptY) {
    for(var x = 0; x< N; x++) {
        for(var y = 0; y<N; y++) {
            if(x === exceptX && y === exceptY){
                continue;
            }

            var isBomb = random() <= odds;
            tiles[x][y].isBomb = isBomb
            if(isBomb) {
                totalBombs ++;
            }
        }
    }

    bombsPlaced = true;   
}

function visit(x, y) {
    if(!tiles[x][y].visited) {    
        totalNotVisited--;
        tiles[x][y].visited = true;
    }    
}

function announce(t, color) {
    push()
    fill("Lavender")
    rect(0, N / 2 * tileSize - 2 * tileSize, tileSize * N, 150)
    textSize(100)
    stroke(color)
    fill(color)
    textAlign(CENTER)
    text(t, N / 2 * tileSize, N / 2 * tileSize)
    pop();
}
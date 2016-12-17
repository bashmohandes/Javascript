"use strict";

var N = 6;
var tiles = [];
var tileSize = 100;
var odds = 0.2;
function setup() {
    for(var x = 0; x< N; x++) {
        tiles[x] = [];
        for(var y = 0; y<N; y++) {
            tiles[x].push(new Tile(x, y, random() <= odds, tileSize));
        }
    }

    createCanvas(600, 600)
    background(0)
}

function draw(){
    drawTiles();
}

function drawTiles() {
    for(var x = 0; x< N; x++) {
        for(var y = 0; y<N; y++) {
            tiles[x][y].draw();
        }
    }
}

function mouseClicked() {
    for(var x = 0; x < N; x++) {
        for(var y = 0; y < N; y++) {
            if(!tiles[x][y].clicked && tiles[x][y].pressed()) {
                check(x, y);
                break;
            }
        }
    }
}

function check(x, y) {
    print(x,y)
    tiles[x][y].visited = true;
    var neighbours = getNeighbours(x, y)
    print(neighbours.length)
    var nearbyBombs = checkNearbyBombs(neighbours);
    tiles[x][y].discoveredNearBombs(nearbyBombs)
    if(nearbyBombs === 0) {
        for(var i = 0; i < neighbours.length; i++) {
            //neighbours[i].highlight();
            print(neighbours[i].x, neighbours[i].y)
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
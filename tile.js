"use strict";

function Tile(x, y, isBomb, tileSize){
    this.x = x;
    this.y = y;
    this.isBomb = isBomb;
    this.tileSize = tileSize;
    this.clicked = false;
    this.visited = false;
    this.nearBombs = 0;
    
    this.draw = function(){
        stroke('White')
        if(!this.visited) {
            noFill();
        } else {
            fill('Grey')
        }

        if(this.highlighted) {
            fill('Yellow')
        }
        rect(this.x * this.tileSize, this.y * this.tileSize, this.tileSize, this.tileSize)

        if(this.isBomb && this.visited) {
            stroke('Red')
            fill('Red');
            ellipse(this.x * this.tileSize  + this.tileSize / 2, this.y * this.tileSize + this.tileSize / 2, this.tileSize / 2, this.tileSize / 2);
        }

        if(this.nearBombs > 0) {
            textSize(this.tileSize / 2)
            stroke('White')
            fill('White')
            text(this.nearBombs, this.x * this.tileSize + this.tileSize / 2, this.y * this.tileSize + this.tileSize / 2);
        }
    };

    this.pressed = function(){
        if(mouseX > this.x * this.tileSize && 
           mouseX < this.x * this.tileSize + this.tileSize && 
           mouseY > this.y * this.tileSize &&
           mouseY < this.y * this.tileSize + this.tileSize){
               this.clicked = true;
               if(this.isBomb) {
                   console.log("GAME OVER!!")
               }
           }

        return this.clicked;
    };

    this.visit = function(bombs) {        
        this.visited = true;
    };

    this.highlight = function() {
        this.highlighted = true;
    };

    this.discoveredNearBombs = function(bombs) {
        this.nearBombs = bombs;
    };
}
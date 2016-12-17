"use strict";

function Tile(x, y, tileSize){
    this.x = x;
    this.y = y;
    this.isBomb = false;
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
/*
        textSize(this.tileSize / 4)
        stroke('White')
        fill('White')
        text(this.x + "," + this.y, this.x * this.tileSize, this.y * this.tileSize+ this.tileSize);
*/
        if(this.nearBombs > 0) {
            textSize(this.tileSize / 2)
            stroke('White')
            fill('White')
            text(this.nearBombs, this.x * this.tileSize + this.tileSize / 2, this.y * this.tileSize + this.tileSize / 2);
        }
    };

    this.pressed = function(){        
        if(floor(mouseX / this.tileSize) === this.x && floor(mouseY / this.tileSize) === this.y){
            this.clicked = true;
        }

        return this.clicked;
    };
}
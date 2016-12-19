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
            fill('LightGrey')
        }

        rect(this.x * this.tileSize, this.y * this.tileSize, this.tileSize, this.tileSize)

        if(this.isBomb && this.visited) {
            stroke('Red')
            fill('Red');
            ellipse(this.x * this.tileSize  + this.tileSize / 2, 
                    this.y * this.tileSize + this.tileSize / 2, 
                    this.tileSize * 0.8, 
                    this.tileSize * 0.8);
        }

        if(this.nearBombs > 0) {
            textAlign(CENTER)
            textSize(this.tileSize / 2)
            var textColor = this.getTextColor(this.nearBombs)
            stroke(textColor)
            fill(textColor)
            text(this.nearBombs, 
                 this.x * this.tileSize + this.tileSize / 2, 
                 this.y * this.tileSize + 3 * this.tileSize / 4);
        }
    };

    this.pressed = function() {        
        if(floor(mouseX / this.tileSize) === this.x && floor(mouseY / this.tileSize) === this.y){
            this.clicked = true;
        }

        return this.clicked;
    };

    this.getTextColor = function(bombs) {
        switch(bombs){            
            case 1:
                return "Blue"
            case 2:
                return "Green"
            case 3:
                return "Red"
            case 4:
                return "Navy"
            case 5:
                return "Darkblue"
            case 6:
                return "DarkGrey"
            default:
                return "White"
        }
    }
}
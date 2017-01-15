/**
 * @param {number[][]} grid
 * @return {number}
 */
var islandPerimeter = function(grid) {    
    var result = 0
    for(var i = 0; i < grid.length; i++) {
        for(var j = 0; j < grid[0].length; j++) {     
            if(!grid[i][j]) {
                continue;
            }

            if(isWater(grid, i - 1, j)) {
                result ++
            }

            if(isWater(grid, i + 1, j)) {
                result ++
            }

            if(isWater(grid, i, j - 1)) {
                result ++
            }

            if(isWater(grid, i, j + 1)) {
                result ++
            }
        }
    }

    return result
};

function isWater(grid, i, j) {
    return i < 0 || i > grid.length - 1 || j < 0 || j > grid[0].length - 1 || !grid[i][j]
}


var input = [[0,1,0,0],
             [1,1,1,0],
             [0,1,0,0],
             [1,1,0,0]]

console.log(islandPerimeter(input))
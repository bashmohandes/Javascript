/**
 * @param {number[][]} grid
 * @return {number}
 */
var islandPerimeter = function(grid) {
    var visited = {}    
    
    for(var i = 0; i < grid.length; i++) {
        for(var j = 0; j < grid[0].length; j++) {     
            if(grid[i][j]) {
                return countSides(grid, i, j, visited)            
            }
        }
    }

    return 0
};


function countSides(grid, i, j, visited) {
    console.log(i, j)
    var sides = 0
    if(visited[i + "," + j]) {
        return 0
    }    

    if(!grid[i][j]) {
        return 1
    }

    visited[i + "," + j] = true

    if(i - 1 < 0) {
        sides ++
    } else {
        sides += countSides(grid, i - 1, j, visited)
    }    

    if(i + 1 > grid.length - 1) {
        sides ++
    } else {
        sides += countSides(grid, i + 1, j, visited)
    }

    if(j - 1 < 0) {
        sides ++
    } else {
        sides += countSides(grid, i, j - 1, visited)
    }

    if(j + 1 > grid[0].length - 1) {
        sides ++
    } else {
        sides += countSides(grid, i, j + 1, visited)
    }
    
    return sides
}

var input = [[0,1,0,0],
             [1,1,1,0],
             [0,1,0,0],
             [1,1,0,0]]

console.log(islandPerimeter(input))
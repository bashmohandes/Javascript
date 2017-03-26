/**
 * problem: https://leetcode.com/problems/keyboard-row/#/description
 * @param {string[]} words
 * @return {string[]}
 */
var findWords = function(words) {
    var result = [];
    var keyBoard = [
            new Set(["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"]),
            new Set(["A", "S", "D", "F", "G", "H", "J", "K", "L"]),
            new Set(["Z", "X", "C", "V", "B", "N", "M"])
                   ];
    for(var i = 0; i< words.length; i++) {
        var row = -1;        
        var oneRow = true;
        for(var c = 0; c < words[i].length; c++) {
            for(var r = 0; r< keyBoard.length; r++) {                
                if(keyBoard[r].has(words[i].charAt(c).toUpperCase())) {                    
                    if(row === -1) {                        
                        row = r;
                    } else {
                        if(r !== row) {                            
                            oneRow = false;
                        }
                    }
                    break;
                }
                if(!oneRow) {
                    break;
                }
            }
            if(!oneRow) {
                break;
            }
        }
                
        if(oneRow) {
           result.push(words[i]) 
        }
    }
    
    return result;
};


console.log(findWords(["Hello", "Alaska", "Dad", "Peace"]));
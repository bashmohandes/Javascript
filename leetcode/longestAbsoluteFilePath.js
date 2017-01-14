/**
 * @param {string} input
 * @return {number}
 */
var lengthLongestPath = function(input) {
    var stack = []
    var parts = input.split("\n")
    var longestPath = 0
    var currentLevel = 0
    for(var i = 0; i<parts.length; i++) {
        var l = getPartLevel(parts[i], 0)
        var pn = parts[i].substring(l)
        if(pn.indexOf(".") >= 0) {
            // file
        } else { // dir
            
        }
        if(level >= currentLevel) {
            stack.push({ level: level, partName: pn })            
        } else {

        }
    }


    function getPartLevel(p, startIndex) {
        if(p.length > startIndex && p[startIndex] != "\t") {
            return 0;
        }

        return 1 + getPartLevel(p, startIndex + 1)
    }
};
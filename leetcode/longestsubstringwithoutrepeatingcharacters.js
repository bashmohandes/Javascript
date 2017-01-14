/**
 * //TODO: Fix
 * @param {string} s
 * @return {number}
 */
var lengthOfLongestSubstring = function(s) {
    var cache = {}    
    var max = 0    
    for(var i = 0, j = 0; i<s.length; i++) {        
        if( s[i] in cache) {
            j = Math.max(j, cache[s[i]] + 1)
        } 
        cache[s[i]] = i
        max = Math.max(max, i - j + 1)        
    }
        
    return max
};

console.log(lengthOfLongestSubstring("bbtablud"))
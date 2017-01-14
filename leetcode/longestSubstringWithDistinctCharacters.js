/**
 * @param {string} s
 * @return {number}
 */
var lengthOfLongestSubstring = function(s) {
    var set = {}
    set[s[0]] = 1
    var longestSubstring = 0
    var longest = [s[0]]
    for(var i = 1; i<s.length; i++) {
        if(s[i] in set) {
            if(s[i] === longest[0]) {
                
            }
        } else if(s[i] !) {

        }
    }
};
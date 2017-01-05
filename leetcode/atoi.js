/**
 * @param {string} str
 * @return {number}
 */
var myAtoi = function(str) {
    if(!str || str.length === 0) {
        return 0
    }
    
    var result = 0;
    var sign;
    var input = str.trim();
    if(input[0] === "+") {
        sign = 1
    } else if(input[0] === "-") {
        sign = -1
    }
    
    if(sign) {
        input = input.substring(1)
    }
    var i = 0
    while(input[i] >= "0" && input[i] <= "9") {        
        result = 10 * result + (input[i++] - "0")
    }
        
    result = sign ? sign * result : result

    if(result > 2147483647) {
        result = 2147483647
    } else if(result < -2147483648) {
        result = -2147483648
    }

    return result
};

console.log(myAtoi("     +0045a10"))
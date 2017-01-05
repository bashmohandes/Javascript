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
    
    for(var i = 0; i<input.length; i++) {
        if(input[i] >= "0" && input[i] <= "9") {
            result += Math.pow(10, input.length - i - 1) * Number(input[i])
        } else {
            result /= Math.pow(10, input.length - i)
            break;
        }
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
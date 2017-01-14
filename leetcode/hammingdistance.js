/**
 * @param {number} x
 * @param {number} y
 * @return {number}
 */
var hammingDistance = function(x, y) {
  var xor = x ^ y // number of different ones
  var d = 0
  while(xor) {
      if(xor & 0x01) {
          d++
      }
      xor >>= 1
  }  

  return d
};


console.log(hammingDistance(1, 4))
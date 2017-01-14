public class Solution {
    public int FindComplement(int num) {
        return ~num + (highestOneBit(num) << 1);
    }
    
    private int highestOneBit(int num) {
        if(num == 0) {
            return 0;
        }
    
        var result = 1;
        while((num >>= 1) > 0) result <<=1;
    
        return result;
    }
}
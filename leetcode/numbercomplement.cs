public class Solution {
    public static int FindComplement(int num) {
        return ~num + (highestOneBit(num) << 1);
    }
    
    private static int highestOneBit(int num) {
        if(num == 0) {
            return 0;
        }
    
        var result = 1;
        while((num >>= 1) > 0) result <<=1;
    
        return result;
    }

    public static void Main() {
        System.Console.WriteLine(FindComplement(5));
    }
}
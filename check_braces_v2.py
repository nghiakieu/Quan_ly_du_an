
import sys

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in '{[(':
                stack.append((char, i + 1, j + 1))
            elif char in '}])':
                if not stack:
                    print(f"Error: Unmatched closing '{char}' at line {i+1} col {j+1}")
                    return
                
                last_char, last_line, last_col = stack.pop()
                expected = '{' if char == '}' else '[' if char == ']' else '('
                if last_char != expected:
                    print(f"Error: Mismatched '{char}' at line {i+1} col {j+1}. Expected closing for '{last_char}' from line {last_line} col {last_col}")
                    return

    if stack:
        first = stack[0]
        print(f"Error: Unclosed '{first[0]}' from line {first[1]} col {first[2]}")
        # print all unclosed
        for item in stack:
             print(f"Unclosed '{item[0]}' at {item[1]}:{item[2]}")
    else:
        print("Success: Braces are balanced.")

if __name__ == "__main__":
    check_balance(sys.argv[1])

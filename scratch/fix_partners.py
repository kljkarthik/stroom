import re

with open('server/routes/partners.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's inspect all occurrences of db.prepare
# Pattern to match:
# db.prepare( <SQL> ).(run|get|all)( <PARAMS> )
# Notice <SQL> can be a template literal `...` or string '...' / "..."

def replace_db_prepare(code):
    pos = 0
    result = []
    while True:
        idx = code.find('db.prepare(', pos)
        if idx == -1:
            result.append(code[pos:])
            break
        result.append(code[pos:idx])
        
        # Determine whether we are inside tx block:
        # Check last 500 chars before idx for 'await adapter.transaction' vs function scope
        # In partners.ts, all transactions are `await adapter.transaction(async (tx) => {`
        # Let's see if the nearest enclosing block is tx
        sub = code[:idx]
        last_tx = sub.rfind('adapter.transaction')
        last_route = sub.rfind('router.')
        is_tx = (last_tx > last_route)
        prefix = 'await tx.' if is_tx else 'await adapter.'

        # Parse sql inside db.prepare( ... )
        # Find the matching closing parenthesis for db.prepare(
        curr = idx + len('db.prepare(')
        # Handle string or template literal
        while curr < len(code) and code[curr] in ' \t\r\n':
            curr += 1
        
        delimiter = code[curr]
        sql_start = curr
        if delimiter in ('`', '"', "'"):
            curr += 1
            while curr < len(code):
                if code[curr] == '\\':
                    curr += 2
                    continue
                if code[curr] == delimiter:
                    curr += 1
                    break
                curr += 1
        else:
            # Identifier / variable
            while curr < len(code) and code[curr] != ')':
                curr += 1
        sql_str = code[sql_start:curr].strip()

        # Find the closing ')' of db.prepare(...)
        while curr < len(code) and code[curr] != ')':
            curr += 1
        curr += 1 # skip ')'

        # Skip whitespace
        while curr < len(code) and code[curr] in ' \t\r\n':
            curr += 1
        
        if code[curr] != '.':
            # Not followed by dot
            result.append(f"db.prepare({sql_str})")
            pos = curr
            continue
        
        curr += 1 # skip '.'
        # Match method name: run / get / all
        method = ''
        while curr < len(code) and code[curr].isalpha():
            method += code[curr]
            curr += 1
        
        while curr < len(code) and code[curr] in ' \t\r\n':
            curr += 1
        
        # Match arguments of .method(...)
        if code[curr] != '(':
            result.append(f"db.prepare({sql_str}).{method}")
            pos = curr
            continue
        
        curr += 1 # skip '('
        args_start = curr
        paren_depth = 1
        in_str = None
        while curr < len(code) and paren_depth > 0:
            ch = code[curr]
            if in_str:
                if ch == '\\':
                    curr += 2
                    continue
                if ch == in_str:
                    in_str = None
            else:
                if ch in ('"', "'", '`'):
                    in_str = ch
                elif ch == '(':
                    paren_depth += 1
                elif ch == ')':
                    paren_depth -= 1
            curr += 1
        args_str = code[args_start:curr-1].strip()

        # Map method:
        # run -> execute
        # get -> queryOne
        # all -> query
        new_method = 'execute' if method == 'run' else ('queryOne' if method == 'get' else 'query')
        
        # Format params
        if args_str:
            if args_str.startswith('...'):
                # e.g. ...params -> params
                param_arg = args_str[3:].strip()
                replacement = f"{prefix}{new_method}({sql_str}, {param_arg})"
            else:
                replacement = f"{prefix}{new_method}({sql_str}, [{args_str}])"
        else:
            replacement = f"{prefix}{new_method}({sql_str})"

        result.append(replacement)
        pos = curr

    return ''.join(result)

new_content = replace_db_prepare(content)

with open('server/routes/partners.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Finished fixing partners.ts")

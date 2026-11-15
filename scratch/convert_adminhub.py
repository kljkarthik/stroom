import re

with open('server/routes/adminHub.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace db import with adapter
text = text.replace("import { db } from '../db/database';", "import { getDatabaseAdapter } from '../db/adapter';")

# 2. Async route handlers
def make_handler_async(m):
    method = m.group(1)
    route = m.group(2)
    mw = m.group(3) or ''
    params = m.group(4)
    if mw.strip():
        return f"router.{method}({route}, {mw}async ({params}) => {{\n    const adapter = getDatabaseAdapter();"
    else:
        return f"router.{method}({route}, async ({params}) => {{\n    const adapter = getDatabaseAdapter();"

text = re.sub(
    r'router\.(get|post|put|patch|delete)\(\s*([\'"][^\'"]+[\'"])\s*,\s*([a-zA-Z0-9_]+(?:\s*,\s*[a-zA-Z0-9_]+)?\s*,\s*)?\s*(?:async\s*)?\((req[^)]*)\)\s*=>\s*\{',
    make_handler_async,
    text
)

# 3. Helpers to await
for fn in ['recordAuditLog', 'createNotification', 'evaluateUserAchievements', 'logActivity', 'notifyPartner']:
    text = re.sub(r'(?<!await\s)(?<!async\s)(?<!function\s)\b' + fn + r'\(', f'await {fn}(', text)

# 4. Dates
text = text.replace("datetime('now')", "CURRENT_TIMESTAMP")
text = text.replace("date('now')", "CURRENT_DATE")

# In line 1085: MAX(0, seats_booked - 1)
text = text.replace(
    "MAX(0, seats_booked - 1)",
    "CASE WHEN seats_booked > 0 THEN seats_booked - 1 ELSE 0 END"
)

# 5. Handle transactions:
# e.g.:
# const updated = db.transaction(() => { ... })();
# db.transaction(() => { ... })();
text = re.sub(
    r'const updated = db\.transaction\(\(\) => \{([\s\S]*?)\}\)\(\);',
    r'const updated = await adapter.transaction(async (tx) => {\1});',
    text
)

text = re.sub(
    r'db\.transaction\(\(\) => \{([\s\S]*?)\}\)\(\);',
    r'await adapter.transaction(async (tx) => {\1});',
    text
)

# 6. Convert db.prepare calls
def convert_db_calls(code):
    pos = 0
    res = []
    while True:
        idx = code.find('db.prepare(', pos)
        if idx == -1:
            res.append(code[pos:])
            break
        res.append(code[pos:idx])
        
        # Check if inside tx
        sub = code[:idx]
        last_tx = sub.rfind('adapter.transaction')
        last_route = sub.rfind('router.')
        is_tx = (last_tx > last_route)
        target = 'tx' if is_tx else 'adapter'

        start_prep = idx + len('db.prepare(')
        curr = start_prep
        while curr < len(code) and code[curr] in ' \t\r\n':
            curr += 1
        
        quote = code[curr]
        if quote in ('`', '"', "'"):
            curr += 1
            while curr < len(code):
                if code[curr] == '\\':
                    curr += 2
                    continue
                if code[curr] == quote:
                    curr += 1
                    break
                curr += 1
        else:
            # Identifier
            while curr < len(code) and code[curr] != ')':
                curr += 1
        sql = code[start_prep:curr].strip()
        
        while curr < len(code) and code[curr] != ')':
            curr += 1
        curr += 1
        
        while curr < len(code) and code[curr] in ' \t\r\n':
            curr += 1
        
        assert code[curr] == '.', f"Expected dot after prepare at {curr}: {code[curr:curr+20]}"
        curr += 1
        
        m_start = curr
        while curr < len(code) and code[curr].isalpha():
            curr += 1
        method = code[m_start:curr]
        
        while curr < len(code) and code[curr] in ' \t\r\n':
            curr += 1
        
        assert code[curr] == '(', f"Expected '(' after method at {curr}: {code[curr:curr+20]}"
        curr += 1
        
        args_start = curr
        depth = 1
        str_q = None
        while curr < len(code) and depth > 0:
            c = code[curr]
            if str_q:
                if c == '\\':
                    curr += 2
                    continue
                if c == str_q:
                    str_q = None
            else:
                if c in ('`', '"', "'"):
                    str_q = c
                elif c == '(':
                    depth += 1
                elif c == ')':
                    depth -= 1
            curr += 1
        
        args = code[args_start:curr-1].strip()
        
        new_m = 'execute' if method == 'run' else ('queryOne' if method == 'get' else 'query')
        if args:
            if args.startswith('...'):
                call = f"await {target}.{new_m}({sql}, {args[3:].strip()})"
            else:
                call = f"await {target}.{new_m}({sql}, [{args}])"
        else:
            call = f"await {target}.{new_m}({sql})"
        
        res.append(call)
        pos = curr

    return ''.join(res)

final_text = convert_db_calls(text)

with open('server/routes/adminHub.ts', 'w', encoding='utf-8') as f:
    f.write(final_text)

print("adminHub.ts conversion complete.")

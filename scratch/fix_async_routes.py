import re

with open('server/routes/adminHub.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace `(req: AuthRequest, res: Response) => {` where not preceded by async
# Look for pattern: `, (req` -> `, async (req`
text = re.sub(
    r'(router\.(?:get|post|put|patch|delete|all)\([^;]+?),\s*(?<!async\s)\((req[^)]*)\)\s*=>\s*\{',
    r'\1, async (\2) => {',
    text
)

# Also ensure `const adapter = getDatabaseAdapter();` is in each handler try block
text = re.sub(
    r'(router\.(?:get|post|put|patch|delete)\([^;]+?try\s*\{(?!\s*const\s+adapter))',
    r'\1\n    const adapter = getDatabaseAdapter();',
    text
)

with open('server/routes/adminHub.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated routes to async in adminHub.ts")

import sys, re
lines = sys.stdin.read().splitlines()
d = {}
for l in lines[2:]:
    parts = l.split('|')
    if len(parts) > 4:
        row = parts[1].strip()
        d['A'+row] = parts[2].strip()
        d['B'+row] = parts[3].strip()
        d['C'+row] = parts[4].strip()

def E(c, path=None):
    if path is None: path = set()
    if c in path: return 'NaN'
    path.add(c)
    v = d[c]
    if not v.startswith('='): return int(v)
    try:
        expr = re.sub(r'[A-C]\d+', lambda m: str(E(m.group(0), path.copy())), v[1:])
        if 'NaN' in expr: return 'NaN'
        return int(eval(expr.replace('/', '//')))
    except:
        return 'NaN'

print(lines[0])
print(lines[1])
for l in lines[2:]:
    parts = l.split('|')
    if len(parts) > 4:
        row = parts[1].strip()
        res = str(E('C'+row))
        print(f"|{parts[1]}|{parts[2]}|{parts[3]}|{res:<10}|")

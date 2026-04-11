import sys,re
l=sys.stdin.readlines()
d={c+m[1].strip():m[i+2].strip()for x in l[2:]for m in[x.split('|')]for i,c in enumerate("ABC")}
def E(c,P=[]):
 if c in P:return"NaN"
 v=d[c]
 if"="not in v:return int(v)
 try:
  e=re.sub(r"[A-C]\d+",lambda m:str(E(m[0],P+[c])),v[1:])
  return"NaN"if"NaN"in e else int(eval(e.replace("/","//")))
 except:return"NaN"
for x in l:
 if"="in x:
  r=x.split('|')[1].strip()
  x=re.sub(r"(=.*?)\s*\|",lambda m:f"{str(E('C'+r)):<10}|",x)
 print(x,end="")

%d|0put =filter(range(199),'!xor(xor(xor(xor(xor(xor(xor(and(v:val,1),and(v:val,2)/2),and(v:val,4)/4),and(v:val,8)/8),and(v:val,16)/16),and(v:val,32)/32),and(v:val,64)/64),and(v:val,128)/128)')|$d
w! .tmp-o2.txt
q!

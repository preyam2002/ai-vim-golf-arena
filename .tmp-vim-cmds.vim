:%s/\(with 0x\|-> 0x\)\(\x\{2\}\)$/\=submatch(0).' ('.printf('0b%08b', str2nr(submatch(2), 16)).')'/
:wq

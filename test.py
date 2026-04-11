import subprocess

def test_vim(keys):
    with open('in2.txt', 'w') as f:
        f.write('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed erat ligula, facilisis.\n')
    with open('script.vim', 'wb') as f:
        f.write((keys + 'ZZ').encode('utf-8'))
    subprocess.run(['vim', '-N', '-u', 'NONE', '-i', 'NONE', '-n', '-s', 'script.vim', 'in2.txt'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with open('in2.txt') as f:
        return f.read()

with open('target.txt') as f:
    target = f.read()

def check(keys):
    res = test_vim(keys)
    if res == target:
        print(f"SUCCESS: {len(keys)} keys -> {repr(keys)}")
    else:
        print(f"FAIL: {repr(keys)}")
        print("Got:")
        print(repr(res))

check(':%s/\\W\\+/\\r/g\rddggjI \x1bjI \x1bqqqqqjk0y^j0Pkk0y^jj0P@qq@q')

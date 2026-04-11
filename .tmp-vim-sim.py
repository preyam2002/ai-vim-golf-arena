start = """print("OPQOPQOPQOPQOPQOPQOPQOPQOPQOPQOPQOPQ0PQOPQOPQOPQ")
print("123123123123123123l23123123123123123123123123123")
print("hijkhijkhijkhijkhijkhijkhijkhijkhijkhijkhijkһijk")
print("klmnkImnklmnklmnklmnklmnklmnklmnklmnklmnklmnklmn")
print("2342342342342342342342Ʒ4234234234234234234234234")
print("ijkijkijkijkijkijkijkijkijkijkijkijkijκijkijkijk")

# vim:ft=python

"""
inserts = [
    (6, 'print("                                      ^         ")'),
    (5, 'print("                      ^                         ")'),
    (4, 'print("     ^                                          ")'),
    (3, 'print("                                            ^   ")'),
    (2, 'print("                  ^                             ")'),
    (1, 'print("                                    ^           ")'),
]
lines = start.splitlines(True)
for lineno, ins in inserts:
    idx = lineno - 1
    line = lines[idx].rstrip("\n")
    lines[idx] = line + "\n" + ins + "\n"
result = "".join(lines)
expected = """print("OPQOPQOPQOPQOPQOPQOPQOPQOPQOPQOPQOPQ0PQOPQOPQOPQ")
print("                                    ^           ")
print("123123123123123123l23123123123123123123123123123")
print("                  ^                             ")
print("hijkhijkhijkhijkhijkhijkhijkhijkhijkhijkhijkһijk")
print("                                            ^   ")
print("klmnkImnklmnklmnklmnklmnklmnklmnklmnklmnklmnklmn")
print("     ^                                          ")
print("2342342342342342342342Ʒ4234234234234234234234234")
print("                      ^                         ")
print("ijkijkijkijkijkijkijkijkijkijkijkijkijκijkijkijk")
print("                                      ^         ")

# vim:ft=python

"""
print("match", result == expected)
if result != expected:
    import difflib
    for line in difflib.unified_diff(expected.splitlines(), result.splitlines()):
        print(line)

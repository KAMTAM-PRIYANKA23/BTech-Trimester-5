"""Create extra CSV test files, e.g.  python make_datasets.py 10000000 large_10m.csv
(For huge sizes prefer the dashboard's generator: data is then made on the Colab machine.)"""
import sys
import numpy as np

n = int(sys.argv[1]) if len(sys.argv) > 1 else 1_000_000
out = sys.argv[2] if len(sys.argv) > 2 else f"generated_{n}.csv"
rng = np.random.default_rng(42)
with open(out, "w") as f:
    f.write("value\n")
    for start in range(0, n, 1_000_000):
        chunk = rng.integers(1, 1001, size=min(1_000_000, n - start))
        f.write("\n".join(map(str, chunk)) + "\n")
print("wrote", out, n, "rows")

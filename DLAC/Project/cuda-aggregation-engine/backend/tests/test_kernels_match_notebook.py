"""Proves kernels.py is the notebook's code, not a re-implementation."""
import ast, json, os, textwrap

NB = os.path.join(os.path.dirname(__file__), "..", "..", "colab", "CUDA_Parallel_Reduction_Engine.ipynb")
NAMES = ["partial_sum", "final_sum", "find_min", "final_min", "find_max", "final_max"]


def _funcs(src):
    tree = ast.parse(src)
    return {n.name: ast.dump(n) for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name in NAMES}


def test_every_kernel_is_identical_to_the_notebook():
    nb = json.load(open(NB))
    nb_src = "\n".join("".join(c["source"]).replace("!nvidia-smi", "") for c in nb["cells"] if c["cell_type"] == "code")
    nb_f = _funcs(nb_src)
    mine = _funcs(open(os.path.join(os.path.dirname(__file__), "..", "app", "kernels.py")).read())
    assert set(nb_f) == set(NAMES) == set(mine)
    for n in NAMES:
        assert nb_f[n] == mine[n], f"{n} differs from the notebook"


def test_text_is_byte_identical_too():
    nb = json.load(open(NB))
    text = "\n".join("".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code")
    mine = open(os.path.join(os.path.dirname(__file__), "..", "app", "kernels.py")).read()
    import re
    for n in NAMES:
        m = re.search(r"@cuda\.jit\ndef " + n + r"\(.*?(?=\n\n\n|\n\n# |\Z)", mine, re.S).group(0).rstrip()
        assert m in text, f"{n} text not found verbatim in notebook"

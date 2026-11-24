# Test datasets

| File | Rows | Purpose |
|---|---|---|
| `small_100k.csv` | 100,000 | Small test. Integers 1-1000, one column with header. |
| `medium_1m.csv` | 1,000,000 | Medium test. |
| `negative_mixed.csv` | 50,000 | Negative and positive decimals (checks sign handling and float tolerance). |
| `multi_column.csv` | 20,000 | Three columns. Type `humidity` in the **Column** box to pick one (auto-detect picks `id`). |
| `messy_demo.csv` | 12 | Contains `abc`, `NaN`, `N/A`, `1e999` (too large for float32) and an empty line (ignored). Shows the validation report. Upload once with "Skip and report" and once with "Reject file". |

Large datasets (10M, 50M) are built into the dashboard (Datasets page), where they are generated on the Colab machine.
For a 10M-row CSV file: `python make_datasets.py 10000000 large_10m.csv` (about 40 MB).

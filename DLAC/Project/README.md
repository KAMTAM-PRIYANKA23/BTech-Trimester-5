
# ⚡ CUDA Parallel Reduction and GPU Aggregation Engine

<p align="center">
  <b>Deep Learning with Accelerated Computing (25CS3112E)</b><br>
  Academic Year 2026–2027
</p>

---

## 📌 Project Overview

The **CUDA Parallel Reduction and GPU Aggregation Engine** is a GPU-accelerated computing project that performs numerical aggregation operations on large datasets using NVIDIA CUDA.

The project uses Python and Numba CUDA to perform four operations:

- Sum
- Average
- Minimum
- Maximum

Instead of processing data sequentially like a traditional CPU approach, the GPU distributes computation across multiple threads and thread blocks to perform operations in parallel.

The project evaluates performance using datasets containing 1 million, 10 million, and 50 million elements. It compares CPU execution time with GPU kernel execution time and overall GPU execution time, including data transfer overhead.

## 🎯 Objectives

- Implement parallel reduction using CUDA kernels.
- Perform sum, average, minimum, and maximum operations.
- Compare CPU and GPU execution performance.
- Evaluate performance across different dataset sizes.
- Measure GPU kernel execution and data transfer time separately.
- Optimize CUDA thread block configurations.
- Verify GPU computation accuracy against CPU results.

## ✨ Key Features

| Feature | Description |
|---|---|
| Parallel Reduction | Uses CUDA threads for parallel numerical computation. |
| Four Aggregation Operations | Supports sum, average, minimum, and maximum. |
| Large Dataset Processing | Tests 1M, 10M, and 50M elements. |
| CPU vs GPU Comparison | Measures performance differences between CPU and GPU. |
| Execution Time Analysis | Separately measures kernel and data transfer time. |
| CUDA Optimization | Evaluates different thread block configurations. |
| Accuracy Validation | Compares GPU results with CPU results. |
| Performance Visualization | Uses graphs and benchmark comparisons. |

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Main programming language |
| NVIDIA CUDA | GPU parallel computing |
| Numba CUDA | Writing and executing CUDA kernels in Python |
| NumPy | Numerical arrays and CPU operations |
| Matplotlib | Performance graphs and visualization |
| Google Colab | Cloud-based GPU execution |
| NVIDIA Tesla T4 | GPU hardware |

## ⚙️ Project Architecture

```text
Input Dataset
     |
     v
Dataset Generation / Upload
     |
     v
+---------------------------+
|     CPU Processing        |
| Sum, Average, Min, Max    |
+---------------------------+
     |
     v
+---------------------------+
|     GPU Processing        |
|   CUDA Parallel Kernels   |
|   Threads and Blocks      |
+---------------------------+
     |
     v
+---------------------------+
|   Performance Analysis    |
| CPU vs GPU Execution      |
| Kernel and Transfer Time  |
+---------------------------+
     |
     v
Accuracy Verification
     |
     v
Results and Visualization

## 📊 Benchmark Results

The project was evaluated using datasets of 1M, 10M, and 50M elements.

| Performance Metric | Recorded Result |
|---|---:|
| GPU Kernel Speedup (50M elements) | 37.81× |
| Overall Speedup (including data transfer) | 1.68× |
| Tested CUDA Block Sizes | 128, 256, 512, 1024 |
| Block Size Optimization | 5.2% improvement (1024 vs 256) |

The results demonstrate the benefits of GPU parallel processing and the impact of memory transfer overhead on overall performance.

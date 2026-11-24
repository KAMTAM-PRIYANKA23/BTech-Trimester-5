"""
CUDA reduction kernels - copied UNCHANGED from the notebook
"CUDA_Parallel_Reduction_Engine.ipynb".

    partial_sum / final_sum : notebook cell 12
    find_min    / final_min : notebook cell 17
    find_max    / final_max : notebook cell 19

The kernel bodies below are byte-for-byte the notebook's code (verified by
tests/test_kernels_match_notebook.py). Nothing here was rewritten.

Design facts the launch code in gpu_engine.py relies on (read from the code):
  * Every kernel declares  cuda.shared.array(256, ...)  -> a block must have
    exactly 256 threads (the tree reduction starts at blockDim.x // 2).
  * The first kernel uses a grid-stride loop (idx += cuda.gridsize(1)), so ANY
    number of blocks >= 1 produces a correct result for ANY n >= 0.
  * The first kernel writes one value per block into `partials`, so `partials`
    must have (at least) `blocks` elements.
  * The final kernel runs in ONE block and loops over `partials` with
    range(tid, n, blockDim.x), so it accepts any partial-array length; it is
    launched with n = blocks.
"""
import numpy as np
from numba import cuda, float32

@cuda.jit
def partial_sum(data, partials, n):
    tid = cuda.threadIdx.x
    idx = cuda.grid(1)
    stride = cuda.gridsize(1)

    # Each thread adds multiple values
    total = float32(0.0)

    while idx < n:
        total += data[idx]
        idx += stride

    # Store each thread's sum in shared memory
    shared = cuda.shared.array(256, dtype=float32)
    shared[tid] = total

    cuda.syncthreads()

    # Combine thread sums within each block
    step = cuda.blockDim.x // 2

    while step > 0:
        if tid < step:
            shared[tid] += shared[tid + step]

        cuda.syncthreads()
        step //= 2

    # One partial sum per block
    if tid == 0:
        partials[cuda.blockIdx.x] = shared[0]


@cuda.jit
def final_sum(partials, result, n):
    tid = cuda.threadIdx.x

    total = float32(0.0)

    # Each thread adds some partial sums
    for i in range(tid, n, cuda.blockDim.x):
        total += partials[i]

    shared = cuda.shared.array(256, dtype=float32)
    shared[tid] = total

    cuda.syncthreads()

    step = cuda.blockDim.x // 2

    while step > 0:
        if tid < step:
            shared[tid] += shared[tid + step]

        cuda.syncthreads()
        step //= 2

    if tid == 0:
        result[0] = shared[0]


@cuda.jit
def find_min(data, partials, n):
    tid = cuda.threadIdx.x
    idx = cuda.grid(1)
    stride = cuda.gridsize(1)

    local_min = float32(np.inf)

    while idx < n:
        if data[idx] < local_min:
            local_min = data[idx]
        idx += stride

    shared = cuda.shared.array(256, dtype=float32)
    shared[tid] = local_min
    cuda.syncthreads()

    step = cuda.blockDim.x // 2

    while step > 0:
        if tid < step:
            if shared[tid + step] < shared[tid]:
                shared[tid] = shared[tid + step]
        cuda.syncthreads()
        step //= 2

    if tid == 0:
        partials[cuda.blockIdx.x] = shared[0]


@cuda.jit
def final_min(partials, result, n):
    tid = cuda.threadIdx.x
    local_min = float32(np.inf)

    for i in range(tid, n, cuda.blockDim.x):
        if partials[i] < local_min:
            local_min = partials[i]

    shared = cuda.shared.array(256, dtype=float32)
    shared[tid] = local_min
    cuda.syncthreads()

    step = cuda.blockDim.x // 2

    while step > 0:
        if tid < step:
            if shared[tid + step] < shared[tid]:
                shared[tid] = shared[tid + step]
        cuda.syncthreads()
        step //= 2

    if tid == 0:
        result[0] = shared[0]


@cuda.jit
def find_max(data, partials, n):
    tid = cuda.threadIdx.x
    idx = cuda.grid(1)
    stride = cuda.gridsize(1)

    local_max = float32(-np.inf)

    while idx < n:
        if data[idx] > local_max:
            local_max = data[idx]
        idx += stride

    shared = cuda.shared.array(256, dtype=float32)
    shared[tid] = local_max
    cuda.syncthreads()

    step = cuda.blockDim.x // 2

    while step > 0:
        if tid < step:
            if shared[tid + step] > shared[tid]:
                shared[tid] = shared[tid + step]
        cuda.syncthreads()
        step //= 2

    if tid == 0:
        partials[cuda.blockIdx.x] = shared[0]


@cuda.jit
def final_max(partials, result, n):
    tid = cuda.threadIdx.x
    local_max = float32(-np.inf)

    for i in range(tid, n, cuda.blockDim.x):
        if partials[i] > local_max:
            local_max = partials[i]

    shared = cuda.shared.array(256, dtype=float32)
    shared[tid] = local_max
    cuda.syncthreads()

    step = cuda.blockDim.x // 2

    while step > 0:
        if tid < step:
            if shared[tid + step] > shared[tid]:
                shared[tid] = shared[tid + step]
        cuda.syncthreads()
        step //= 2

    if tid == 0:
        result[0] = shared[0]

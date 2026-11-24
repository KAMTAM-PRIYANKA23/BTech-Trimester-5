"""Entry point used by the Colab notebook (and for local simulator tests)."""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")),
                log_level="info", workers=1)

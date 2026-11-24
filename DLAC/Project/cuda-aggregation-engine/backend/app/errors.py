"""One error type so every failure reaches the UI as {code, message, hint}."""


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, hint: str = ""):
        super().__init__(message)
        self.status, self.code, self.message, self.hint = status, code, message, hint

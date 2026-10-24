from pydantic import BaseModel


class RestoreResponse(BaseModel):
    # Login accounts restored from the backup; each one sets a new password next
    emails: list[str]

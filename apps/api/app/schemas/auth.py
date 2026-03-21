from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
import uuid

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=128)
    confirm_password: str
    agreed_to_terms: bool

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'RegisterRequest':
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match.')
        return self

    @model_validator(mode='after')
    def check_terms(self) -> 'RegisterRequest':
        if not self.agreed_to_terms:
            raise ValueError('You must agree to the Terms of Service to create an account.')
        return self

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=10, max_length=128)
    confirm_password: str

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'ResetPasswordRequest':
        if self.new_password != self.confirm_password:
            raise ValueError('Passwords do not match.')
        return self

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    has_family: bool

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    user: UserResponse
    message: Optional[str] = None

class MessageResponse(BaseModel):
    message: str

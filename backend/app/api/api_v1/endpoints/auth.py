from datetime import timedelta, datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.api import deps
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import User as UserSchema, UserCreate, ForgotPassword, ResetPassword
from app.utils.email import send_reset_password_email
router = APIRouter()

@router.post("/login/access-token", response_model=Token)
def login_access_token(
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/test-token", response_model=UserSchema)
def test_token(current_user: User = Depends(deps.get_current_user)) -> Any:
    """
    Test access token
    """
    return current_user

# Initial setup helper - Only works when no admin exists
@router.post("/setup-admin", response_model=UserSchema)
def setup_initial_admin(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate
) -> Any:
    """
    Create initial admin user. Blocked if an admin already exists.
    """
    # Security: Block if any admin already exists
    existing_admin = db.query(User).filter(User.role == "admin").first()
    if existing_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin already exists. Use admin account to manage users."
        )

    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        role="admin"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/register", response_model=UserSchema)
def register(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate
) -> Any:
    """
    Register a new user. The user will be created but inactive until approved by an admin.
    """
    user_by_username = db.query(User).filter(User.username == user_in.username).first()
    user_by_email = db.query(User).filter(User.email == user_in.email).first()
    if user_by_username:
        raise HTTPException(status_code=400, detail="Username already exists")
    if user_by_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        role="viewer", # Default role
        is_active=False # Must be approved by admin
    )
    db.add(user)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/forgot-password")
def forgot_password(
    *,
    db: Session = Depends(deps.get_db),
    params: ForgotPassword
) -> Any:
    """
    Password Recovery - Generate token and send email
    """
    user = db.query(User).filter(User.email == params.email).first()
    if not user:
        # Prevent user enumeration - still return 200
        return {"message": "Nếu email tồn tại, một mã khôi phục sẽ được gửi đến bạn."}
    
    # Generate 6-digit token
    import random
    reset_token = f"{random.randint(100000, 999999)}"
    
    # Store token and expiry (15 mins)
    user.reset_token = reset_token
    user.reset_token_expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(user)
    db.commit()
    
    # Send email
    if not send_reset_password_email(email_to=user.email, reset_token=reset_token):
        raise HTTPException(
            status_code=500,
            detail="Không thể gửi email lúc này. Vui lòng cấu hình SMTP_USER và SMTP_PASSWORD trên server."
        )
        
    return {"message": "Nếu email tồn tại, một mã khôi phục sẽ được gửi đến bạn."}

@router.post("/reset-password")
def reset_password(
    *,
    db: Session = Depends(deps.get_db),
    params: ResetPassword
) -> Any:
    """
    Reset password using token
    """
    user = db.query(User).filter(User.email == params.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Mã khôi phục không hợp lệ hoặc đã hết hạn.")
        
    if not user.reset_token or user.reset_token != params.token:
        raise HTTPException(status_code=400, detail="Mã khôi phục không hợp lệ hoặc đã hết hạn.")
        
    # Timezone-aware expiration check
    now = datetime.now(timezone.utc)
    # Convert token expire to UTC if it's naive
    expire_time = user.reset_token_expire
    if expire_time.tzinfo is None:
        expire_time = expire_time.replace(tzinfo=timezone.utc)

    if expire_time < now:
        raise HTTPException(status_code=400, detail="Mã khôi phục đã hết hạn. Vui lòng yêu cầu mã mới.")
        
    # Valid token -> Reset password
    user.hashed_password = security.get_password_hash(params.new_password)
    user.reset_token = None
    user.reset_token_expire = None
    
    db.add(user)
    db.commit()
    
    return {"message": "Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập lại."}

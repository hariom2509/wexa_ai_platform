from fastapi import APIRouter, Depends, Response, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import UserCreate, UserLogin, Token, UserOut, InviteCreate, InviteAccept
from app.services.auth_service import auth_service
from app.api.deps import get_current_user, RoleChecker
from app.models.user import User
from app.core.security import decode_token, create_access_token

router = APIRouter()

@router.post("/register", response_model=UserOut, status_code=201)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    return await auth_service.register(db, user_in)

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    access_token, refresh_token = await auth_service.authenticate(db, user_in)
    
    # Set HTTP-only cookie for refresh token
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True, # Should be True in production (HTTPS)
        samesite="lax",
        max_age=7 * 24 * 60 * 60 # 7 days
    )
    
    return Token(access_token=access_token, token_type="bearer")

@router.post("/refresh", response_model=Token)
async def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Generate new access token
        new_access_token = create_access_token(subject=user_id)
        return Token(access_token=new_access_token, token_type="bearer")
        
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="refresh_token")
    return {"detail": "Logged out successfully"}

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/invite")
async def create_invite(
    invite_in: InviteCreate,
    current_user: User = Depends(RoleChecker(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    invite = await auth_service.create_invite(db, invite_in, current_user)
    return {"detail": f"Invite generated for {invite.email}", "token": invite.token}

@router.post("/accept-invite", response_model=UserOut)
async def accept_invite(accept_in: InviteAccept, db: AsyncSession = Depends(get_db)):
    return await auth_service.accept_invite(db, accept_in)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import secrets
import hashlib

from app.core.database import get_db
from app.models.user import User
from app.models.api_key import ApiKey
from app.schemas.auth import ApiKeyCreate, ApiKeyOut
from app.api.deps import RoleChecker

router = APIRouter()


def generate_api_key():
    raw_key = secrets.token_urlsafe(32)
    prefix = raw_key[:8]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    return raw_key, prefix, key_hash


@router.get("/", response_model=List[ApiKeyOut])
async def list_api_keys(
    current_user: User = Depends(RoleChecker(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.organization_id == current_user.organization_id,
            ApiKey.is_active == True
        )
    )
    return result.scalars().all()


@router.post("/", response_model=ApiKeyOut)
async def create_api_key(
    key_in: ApiKeyCreate,
    current_user: User = Depends(RoleChecker(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    raw_key, prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        name=key_in.name,
        prefix=prefix,
        key_hash=key_hash,
        organization_id=current_user.organization_id
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    # Return raw key only once
    response_data = ApiKeyOut.model_validate(api_key).model_dump()
    response_data["raw_key"] = raw_key
    return response_data


@router.post("/{key_id}/rotate", response_model=ApiKeyOut)
async def rotate_api_key(
    key_id: int,
    current_user: User = Depends(RoleChecker(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Rotate an API key — revokes old key and issues a new one with the same name."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.organization_id == current_user.organization_id
        )
    )
    old_key = result.scalars().first()
    if not old_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    # Revoke the old key
    old_key.is_active = False
    await db.flush()

    # Create a new key with same name
    raw_key, prefix, key_hash = generate_api_key()
    new_key = ApiKey(
        name=old_key.name,
        prefix=prefix,
        key_hash=key_hash,
        organization_id=current_user.organization_id
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    response_data = ApiKeyOut.model_validate(new_key).model_dump()
    response_data["raw_key"] = raw_key
    return response_data


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: int,
    current_user: User = Depends(RoleChecker(["owner", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.organization_id == current_user.organization_id
        )
    )
    api_key = result.scalars().first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    api_key.is_active = False
    await db.commit()
    return {"detail": "API Key revoked successfully"}

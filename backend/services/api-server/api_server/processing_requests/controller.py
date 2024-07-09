import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends
from fastapi.exceptions import HTTPException

from api_server.assets.service import AssetService, get_asset_service
from api_server.processing_requests.model import ProcessingRequest
from api_server.processing_requests.repository import ProcessingRequestNotFound
from api_server.processing_requests.schemas import (
    AssetIn,
    AssetsOut,
    PatchProcessingRequest,
    ProcessingRequestIn,
    ProcessingRequestOut,
)
from api_server.processing_requests.service import (
    AssetAlreadyExists,
    AssetAlreadyInOutputAssets,
    AssetDoesNotBelongToProject,
    AssetNotFound,
    NotEnoughPermissions,
    ProcessingRequestService,
    ProjectNotFound,
    QueueNotAvailable,
    UserNotFound,
    get_processing_request_service,
)
from api_server.users.db import User
from api_server.users.users import current_user
from api_server.utils.exceptions.http_exceptions import (
    AssetAlreadyExistsHTTP,
    AssetAlreadyInInputAssetsHTTP,
    AssetAlreadyInOutputAssetsHTTP,
    AssetDoesNotBelongToProjectHTTP,
    AssetNotFoundHTTP,
    NotEnoughPermissionsHTTP,
    ProcessingRequestNotFoundHTTP,
    ProjectNotFoundHTTP,
    UserNotFoundHTTP,
)

router = APIRouter()


# General API


@router.get("/", response_model=list[ProcessingRequestOut], tags=["processing_requests"])
async def get_processing_requests(
    user_id: Optional[uuid.UUID] = None,
    project_id: Optional[uuid.UUID] = None,
    asset_id: Optional[uuid.UUID] = None,
    input_asset_id: Optional[uuid.UUID] = None,
    output_asset_id: Optional[uuid.UUID] = None,
    with_output_assets: Optional[bool] = False,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    asset_service: AssetService = Depends(get_asset_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Get processing requests either by user_id, project_id or asset_id. Superusers can get all processing requests.
    """
    current_user_id = str(user.id)
    requested_user_id = str(user_id) if user_id is not None else None

    # Processing requests of other users can be accessed only by superusers
    if user_id is not None and current_user_id != requested_user_id:
        _raise_for_not_superuser(user)
        return await processing_request_service.get_processing_requests_by_user_id(user_id)

    if project_id is not None:
        try:
            processing_requests = await processing_request_service.get_processing_requests_by_project_id(
                project_id, user.__dict__
            )
            if with_output_assets:
                for processing_request in processing_requests:
                    if len(processing_request.output_assets_ids) > 0:
                        processing_request.output_assets = await asset_service.get_assets_by_ids(
                            processing_request.output_assets_ids
                        )
            return processing_requests

        except NotEnoughPermissions:
            raise NotEnoughPermissionsHTTP()

    if asset_id is not None:
        return await processing_request_service.get_processing_requests_by_asset_id(asset_id)

    if input_asset_id is not None:
        return await processing_request_service.get_processing_requests_by_input_asset_id(input_asset_id)

    if output_asset_id is not None:
        return await processing_request_service.get_processing_requests_by_output_asset_id(output_asset_id)

    return await processing_request_service.get_processing_requests_by_user_id(user.id)


@router.post("/", response_model=ProcessingRequestOut, tags=["processing_requests"], status_code=201)
async def create_processing_request(
    processing_request_data: ProcessingRequestIn,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Create a processing request for the authenticated user.
    """
    try:
        return await processing_request_service.create_processing_request(
            type=processing_request_data.type,
            user_id=user.id,
            project_id=processing_request_data.project_id,
            input_assets_ids=processing_request_data.input_assets_ids,
            should_notify=processing_request_data.should_notify,
            current_user=user.__dict__,
        )
    except UserNotFound:
        raise UserNotFoundHTTP()
    except ProjectNotFound:
        raise ProjectNotFoundHTTP()
    except AssetNotFound as e:
        raise AssetNotFoundHTTP(f"Asset not found: {e.asset_id}")
    except NotEnoughPermissions:
        raise NotEnoughPermissionsHTTP()
    except QueueNotAvailable:
        raise HTTPException(status_code=503, detail="Service Unavailable")


@router.delete("/{processing_request_id}", tags=["processing_requests"], status_code=204)
async def cancel_processing_request(
    processing_request_id: uuid.UUID,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> None:
    """
    Cancel a processing request for the authenticated user.
    """
    try:
        await processing_request_service.delete_or_cancel_request(
            processing_request_id=processing_request_id, current_user=user.__dict__
        )
    except UserNotFound:
        raise UserNotFoundHTTP()
    except ProjectNotFound:
        raise ProjectNotFoundHTTP()
    except AssetNotFound as e:
        raise AssetNotFoundHTTP(f"Asset not found: {e.asset_id}")
    except NotEnoughPermissions:
        raise NotEnoughPermissionsHTTP()
    except QueueNotAvailable:
        raise HTTPException(status_code=503, detail="Service Unavailable")


@router.get("/{processing_request_id}", response_model=ProcessingRequestOut, tags=["processing_requests"])
async def get_processing_request(
    processing_request_id: uuid.UUID,
    with_output_assets: Optional[bool] = False,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
    asset_service: AssetService = Depends(get_asset_service),
) -> Any:
    """
    Get a processing request by its id.
    """
    try:
        processing_request = await processing_request_service.get_processing_request(processing_request_id)
        processing_request.output_assets = await asset_service.get_assets_by_ids(processing_request.output_assets_ids)
    except ProcessingRequestNotFound:
        raise ProcessingRequestNotFoundHTTP()
    _raise_for_no_access_to_processing_request(processing_request, user)
    return processing_request


@router.patch("/{processing_request_id}", response_model=ProcessingRequestOut, tags=["processing_requests"])
async def update_processing_request(
    processing_request_id: uuid.UUID,
    processing_request_data: PatchProcessingRequest,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Patch a processing request by its ID.
    """
    try:
        processing_request = await processing_request_service.get_processing_request(processing_request_id)
    except ProcessingRequestNotFound:
        raise ProcessingRequestNotFoundHTTP()
    _raise_for_no_access_to_processing_request(processing_request, user)
    return await processing_request_service.update_processing_request(
        processing_request_id=processing_request_id,
        **processing_request_data.model_dump(exclude_unset=True),
    )


# Processing requests' assets API


@router.get("/{processing_request_id}/input-assets", response_model=AssetsOut, tags=["processing_requests_assets"])
async def get_input_assets_of_processing_request(
    processing_request_id: uuid.UUID,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Get the input assets of a processing request.
    """
    try:
        processing_request = await processing_request_service.get_processing_request(processing_request_id)
    except ProcessingRequestNotFound:
        raise ProcessingRequestNotFoundHTTP()
    _raise_for_no_access_to_processing_request(processing_request, user)
    response = AssetsOut(assets=processing_request.input_assets_ids)
    return response


@router.post(
    "/{processing_request_id}/input-assets", response_model=ProcessingRequestOut, tags=["processing_requests_assets"]
)
async def add_input_asset_to_processing_request(
    processing_request_id: uuid.UUID,
    input_asset_data: AssetIn,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Add an input asset to a processing request.
    """
    try:
        processing_request = await processing_request_service.get_processing_request(processing_request_id)
    except ProcessingRequestNotFound:
        raise ProcessingRequestNotFoundHTTP()
    _raise_for_no_access_to_processing_request(processing_request, user)
    try:
        return await processing_request_service.add_input_asset_to_processing_request(
            processing_request_id=processing_request_id,
            asset_id=input_asset_data.asset_id,
        )
    except AssetNotFound as e:
        raise AssetNotFoundHTTP(f"Asset not found: {e.asset_id}")
    except AssetDoesNotBelongToProject:
        raise AssetDoesNotBelongToProjectHTTP()
    except AssetAlreadyExists:
        raise AssetAlreadyExistsHTTP()
    except AssetAlreadyInOutputAssets:
        raise AssetAlreadyInOutputAssetsHTTP()


@router.get("/{processing_request_id}/output-assets", response_model=AssetsOut, tags=["processing_requests_assets"])
async def get_output_assets_of_processing_request(
    processing_request_id: uuid.UUID,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Get the output assets of a processing request.
    """
    try:
        processing_request = await processing_request_service.get_processing_request(processing_request_id)
    except ProcessingRequestNotFound:
        raise ProcessingRequestNotFoundHTTP()
    _raise_for_no_access_to_processing_request(processing_request, user)
    response = AssetsOut(assets=processing_request.output_assets_ids)
    return response


@router.post(
    "/{processing_request_id}/output-assets", response_model=ProcessingRequestOut, tags=["processing_requests_assets"]
)
async def add_output_asset_to_processing_request(
    processing_request_id: uuid.UUID,
    output_asset_data: AssetIn,
    processing_request_service: ProcessingRequestService = Depends(get_processing_request_service),
    user: User = Depends(current_user),
) -> Any:
    """
    Add an output asset to a processing request.
    """
    try:
        processing_request = await processing_request_service.get_processing_request(processing_request_id)
    except ProcessingRequestNotFound:
        raise ProcessingRequestNotFoundHTTP()
    _raise_for_no_access_to_processing_request(processing_request, user)
    try:
        return await processing_request_service.add_output_asset_to_processing_request(
            processing_request_id=processing_request_id,
            asset_id=output_asset_data.asset_id,
        )
    except AssetNotFound as e:
        raise AssetNotFoundHTTP(f"Asset not found: {e.asset_id}")
    except AssetDoesNotBelongToProject:
        raise AssetDoesNotBelongToProjectHTTP()
    except AssetAlreadyExists:
        raise AssetAlreadyExistsHTTP()
    except AssetAlreadyInOutputAssets:
        raise AssetAlreadyInInputAssetsHTTP()


def _raise_for_no_access_to_processing_request(processing_request: ProcessingRequest, user: User) -> None:
    if user.is_superuser:
        return

    processing_request_user_id = str(processing_request.user_id)
    user_id = str(user.id)
    if user_id != processing_request_user_id:
        raise NotEnoughPermissionsHTTP()


def _raise_for_not_superuser(user: User) -> None:
    if not user.is_superuser:
        raise NotEnoughPermissionsHTTP()

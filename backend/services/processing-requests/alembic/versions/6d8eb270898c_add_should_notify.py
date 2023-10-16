"""Add should_notify

Revision ID: 6d8eb270898c
Revises: ccf96071c656
Create Date: 2023-10-16 19:13:54.762579

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d8eb270898c'
down_revision: Union[str, None] = 'ccf96071c656'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('processing_request', sa.Column('should_notify', sa.Boolean(), nullable=False))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('processing_request', 'should_notify')
    # ### end Alembic commands ###

ARG PYTHON_VERSION=3.10.14
FROM python:${PYTHON_VERSION}-slim as base


RUN apt-get update && \
    apt-get install -y git build-essential liblapack-dev \
    libopenblas-dev libatlas-base-dev libblas-dev python3-cvxopt \
    libsuitesparse-dev libdsdp-dev libfftw3-dev libglpk-dev libgsl-dev
# Prevents Python from writing pyc files.
ENV PYTHONDONTWRITEBYTECODE=1

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1

WORKDIR /worker

# Copy the source code into the container.
COPY README.md .
COPY lib/. ./lib
COPY poetry* .
COPY pyproject.toml .
COPY optimos_worker/__init__.py ./optimos_worker/__init__.py

# Install the local dependencies
RUN --mount=type=cache,target=/root/.cache/pip python3 -m pip install .
COPY optimos_worker ./optimos_worker
RUN --mount=type=cache,target=/root/.cache/pip python3 -m pip install .
# Run the application.
CMD python3 optimos_worker/main.py
